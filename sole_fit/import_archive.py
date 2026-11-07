"""Import the local Archive into this standalone app; existing fit votes are untouched."""
import argparse
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent


def import_archive(source):
    source = Path(source).resolve()
    records = json.loads((source / 'data/sneakers.json').read_text(encoding='utf-8'))
    inventory = json.loads((source / 'data/images.json').read_text(encoding='utf-8'))['items']
    provenance = json.loads((source / 'data/provenance.json').read_text(encoding='utf-8'))
    if set(records) != set(inventory):
        raise ValueError('Catalog and image IDs must match.')
    items = []
    for key, attributes in records.items():
        media = inventory[key]
        photo = (source / media['image']).resolve()
        if not photo.is_relative_to(source / 'images') or not photo.is_file():
            raise ValueError(f'Invalid or missing image for {key}.')
        if not str(key).isdecimal() or int(key) < 1:
            raise ValueError('Sneaker IDs must be positive integers.')
        required = {'brand', 'name', 'category', 'cut', 'materials', 'cushioning', 'closure_type'}
        if any(not isinstance(attributes.get(field), str) or not attributes[field].strip() for field in required):
            raise ValueError(f'Incomplete fit attributes for {key}.')
        items.append({'id': int(key), 'attributes': attributes, 'image_url': f'images/{photo.name}',
                      'image_note': media.get('note', ''), 'provenance': provenance.get(key, {})})
    (ROOT / 'data').mkdir(exist_ok=True)
    (ROOT / 'images').mkdir(exist_ok=True)
    for item in items:
        shutil.copy2(source / item['image_url'], ROOT / item['image_url'])
    temporary = ROOT / 'data/catalog.tmp'
    temporary.write_text(json.dumps({'count': len(items), 'items': items}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(ROOT / 'data/catalog.json')
    print(f'Imported {len(items)} archive sneakers and local photos. Publish to Supabase with: python ../migration/sync_catalog.py. Existing votes are preserved.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('archive_directory', nargs='?', default=str(ROOT.parent / 'my_fastapi_service_sole_list'))
    import_archive(parser.parse_args().archive_directory)
