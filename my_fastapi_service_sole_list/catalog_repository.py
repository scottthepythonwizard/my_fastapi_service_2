"""Database access for the shared Sole sneaker catalog."""
import os
from pathlib import Path

import psycopg
from psycopg import sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from catalog import SneakerAttributes, UNKNOWN

SUPABASE_CA = Path(__file__).with_name('supabase-root.crt')


class DatabaseUnavailable(RuntimeError):
    pass


class DuplicateReference(RuntimeError):
    pass


def _item(row):
    if row is None:
        return None
    attributes = {field: row.pop(field) for field in SneakerAttributes.model_fields}
    if attributes['year'] is None:
        attributes['year'] = UNKNOWN
    return {**row, 'attributes': attributes}


class CatalogRepository:
    def _query(self, statement, params=()):
        dsn = os.environ.get('SOLE_DATABASE_URL')
        if not dsn:
            raise DatabaseUnavailable
        try:
            with psycopg.connect(dsn, connect_timeout=5, sslmode='verify-full',
                                 sslrootcert=os.environ.get('SOLE_DATABASE_CA_FILE') or str(SUPABASE_CA),
                                 prepare_threshold=None, row_factory=dict_row) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SET LOCAL statement_timeout = '5s'")
                    cursor.execute(statement, params)
                    return cursor.fetchall()
        except psycopg.errors.UniqueViolation:
            raise DuplicateReference from None
        except (psycopg.Error, ValueError):
            raise DatabaseUnavailable from None

    def list(self):
        return [_item(row) for row in self._query('SELECT * FROM sole.sneakers ORDER BY id')]

    def get(self, sneaker_id):
        rows = self._query('SELECT * FROM sole.sneakers WHERE id = %s', (sneaker_id,))
        return _item(rows[0]) if rows else None

    def count(self):
        return self._query('SELECT count(*) AS count FROM sole.sneakers')[0]['count']

    def create(self, values):
        columns = sql.SQL(', ').join(map(sql.Identifier, values))
        placeholders = sql.SQL(', ').join(sql.Placeholder() for _ in values)
        query = sql.SQL('INSERT INTO sole.sneakers ({}) VALUES ({}) RETURNING *').format(columns, placeholders)
        return _item(self._query(query, _parameters(values))[0])

    def update(self, sneaker_id, values):
        assignments = sql.SQL(', ').join(sql.SQL('{} = %s').format(sql.Identifier(field)) for field in values)
        query = sql.SQL('UPDATE sole.sneakers SET {} WHERE id = %s RETURNING *').format(assignments)
        rows = self._query(query, (*_parameters(values), sneaker_id))
        return _item(rows[0]) if rows else None

    def delete(self, sneaker_id):
        return bool(self._query('DELETE FROM sole.sneakers WHERE id = %s RETURNING id', (sneaker_id,)))


def _parameters(values):
    return tuple(
        Jsonb(value) if key == 'provenance' else None if key == 'year' and value == UNKNOWN else value
        for key, value in values.items()
    )
