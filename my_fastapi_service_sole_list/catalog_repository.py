"""Transactional catalog access for SOLE's category-detail schema."""
import os
from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg import sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from catalog import SneakerAttributes, UNKNOWN

SUPABASE_CA = Path(__file__).with_name('supabase-root.crt')
TABLES = ('lifestyle', 'basketball', 'running', 'football')
PARENT = {'category', 'shoe_reference_number', 'image_note', 'provenance'}
CATALOG = '''SELECT s.id, s.category, s.shoe_reference_number, s.image_note, s.provenance,
 d.brand, d.name, d.year, d.descriptive_overview, d.gender_target, d.retail_price,
 d.colorway, d.description, d.details_specifications, d.review_stars, d.materials,
 d.country_of_origin, d.closure_type, d.cut, d.sole_material, d.cushioning,
 d.weight_g, d.release_month, d.image_url
 FROM sole.sneakers s JOIN (
 SELECT * FROM sole.lifestyle UNION ALL SELECT * FROM sole.basketball
 UNION ALL SELECT * FROM sole.running UNION ALL SELECT * FROM sole.football
 ) d USING (id)'''

class DatabaseUnavailable(RuntimeError):
    pass

class DuplicateReference(RuntimeError):
    pass

def _item(row):
    if row is None:
        return None
    row = dict(row)
    attributes = {field: row.pop(field) for field in SneakerAttributes.model_fields}
    if attributes['year'] is None:
        attributes['year'] = UNKNOWN
    return {**row, 'attributes': attributes}

def _parameters(values):
    return tuple(Jsonb(value) if key == 'provenance' else
                 None if key == 'year' and value == UNKNOWN else value
                 for key, value in values.items())

def _table(category):
    table = category.lower()
    if table not in TABLES:
        raise ValueError('Unknown category')
    return table

def _insert(cursor, table, values):
    cursor.execute(sql.SQL('INSERT INTO sole.{} ({}) VALUES ({}) RETURNING id').format(
        sql.Identifier(table), sql.SQL(', ').join(map(sql.Identifier, values)),
        sql.SQL(', ').join(sql.Placeholder() for _ in values)), _parameters(values))
    return cursor.fetchone()['id']

def _update(cursor, table, identity, values):
    if not values:
        return
    cursor.execute(sql.SQL('UPDATE sole.{} SET {} WHERE id=%s').format(
        sql.Identifier(table), sql.SQL(', ').join(
            sql.SQL('{}=%s').format(sql.Identifier(key)) for key in values)),
        (*_parameters(values), identity))

class CatalogRepository:
    @contextmanager
    def _cursor(self):
        dsn = os.environ.get('SOLE_DATABASE_URL')
        if not dsn:
            raise DatabaseUnavailable
        try:
            with psycopg.connect(dsn, connect_timeout=5, sslmode='verify-full',
                    sslrootcert=os.environ.get('SOLE_DATABASE_CA_FILE') or str(SUPABASE_CA),
                    prepare_threshold=None, row_factory=dict_row) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL statement_timeout = '5s'")
                    yield cursor
        except psycopg.errors.UniqueViolation:
            raise DuplicateReference from None
        except (psycopg.Error, ValueError):
            raise DatabaseUnavailable from None

    def _query(self, statement, params=()):
        with self._cursor() as cursor:
            cursor.execute(statement, params)
            return cursor.fetchall()

    def list(self):
        return [_item(row) for row in self._query(CATALOG + ' ORDER BY s.id')]

    def get(self, sneaker_id):
        rows = self._query(CATALOG + ' WHERE s.id=%s', (sneaker_id,))
        return _item(rows[0]) if rows else None

    def count(self):
        return self._query('SELECT count(*) AS count FROM sole.sneakers')[0]['count']

    def create(self, values):
        with self._cursor() as cursor:
            identity = _insert(cursor, 'sneakers', {k:v for k,v in values.items() if k in PARENT})
            _insert(cursor, _table(values['category']), {'id': identity, **{k:v for k,v in values.items() if k not in PARENT}})
            cursor.execute(CATALOG + ' WHERE s.id=%s', (identity,))
            return _item(cursor.fetchone())

    def update(self, sneaker_id, values):
        with self._cursor() as cursor:
            cursor.execute('SELECT category FROM sole.sneakers WHERE id=%s FOR UPDATE', (sneaker_id,))
            parent = cursor.fetchone()
            if not parent:
                return None
            old_table = _table(parent['category'])
            new_table = _table(values.get('category', parent['category']))
            if new_table != old_table:
                cursor.execute(sql.SQL('SELECT * FROM sole.{} WHERE id=%s').format(sql.Identifier(old_table)), (sneaker_id,))
                details = dict(cursor.fetchone())
                details.update({k:v for k,v in values.items() if k not in PARENT})
                cursor.execute(sql.SQL('DELETE FROM sole.{} WHERE id=%s').format(sql.Identifier(old_table)), (sneaker_id,))
                _insert(cursor, new_table, details)
            else:
                _update(cursor, old_table, sneaker_id, {k:v for k,v in values.items() if k not in PARENT})
            _update(cursor, 'sneakers', sneaker_id, {k:v for k,v in values.items() if k in PARENT})
            cursor.execute(CATALOG + ' WHERE s.id=%s', (sneaker_id,))
            return _item(cursor.fetchone())

    def delete(self, sneaker_id):
        with self._cursor() as cursor:
            cursor.execute('SELECT category FROM sole.sneakers WHERE id=%s FOR UPDATE', (sneaker_id,))
            parent = cursor.fetchone()
            if not parent:
                return False
            cursor.execute(sql.SQL('DELETE FROM sole.{} WHERE id=%s').format(sql.Identifier(_table(parent['category']))), (sneaker_id,))
            cursor.execute('DELETE FROM sole.sneakers WHERE id=%s', (sneaker_id,))
            return True
