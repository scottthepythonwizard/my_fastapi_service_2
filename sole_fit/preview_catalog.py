"""Local read-only preview; no database connections or writes."""
import json
from pathlib import Path
class DatabaseUnavailable(RuntimeError): pass
class PreviewCatalog:
    def initialize(self, catalog_path=None): self.catalog()
    def catalog(self): return json.loads((Path(__file__).parent/'data/catalog.json').read_text(encoding='utf-8'))['items']
    def sneaker(self, identity): return next((x for x in self.catalog() if x['id']==identity),None)
    def stats(self, identity):
        fit=dict.fromkeys(('runs_small','true_to_size','runs_large'),0)
        width=dict.fromkeys(('narrow','standard','wide'),0)
        return {'sneaker_id':identity,'total_votes':0,'tts_percentage':0,'length_distribution':{'counts':fit,'percentages':fit.copy()},'width_distribution':{'counts':width,'percentages':width.copy()},'preview':True}
