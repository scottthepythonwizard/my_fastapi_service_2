# Sole

Sole Archive, Sole Fit, and Sole Compare share a Supabase sneaker catalog through FastAPI.

## Live websites

- [Sole Archive](https://my-fastapi-service-2.vercel.app/archive)
- [Sole Fit](https://my-fastapi-service-2.vercel.app/fit/)
- [Sole Compare](https://my-fastapi-service-2.vercel.app/compare/)
- [API health](https://my-fastapi-service-2.vercel.app/health)
- [API documentation](https://my-fastapi-service-2.vercel.app/docs)

Vercel runs the shared FastAPI server in production. The server connects to Supabase using production secrets. Opening these URLs works independently of the local launcher.

## Start locally

1. Create a Python environment with `python -m venv my_fastapi_service_sole_list/.venv`.
2. Install dependencies with `my_fastapi_service_sole_list/.venv/Scripts/python.exe -m pip install -r my_fastapi_service_sole_list/requirements.txt -r sole_fit/requirements.txt`.
3. Copy `.env.example` to `.env` and configure your database URL and admin token.
4. Open `START_SOLE.cmd`.

The shared server serves Archive at `http://127.0.0.1:8000/archive`, Fit at `http://127.0.0.1:8000/fit/`, and Compare at `http://127.0.0.1:8000/compare/`.

The Archive application lives in `my_fastapi_service_sole_list/`. The other site sources live in `sole_fit/` and `sole_compare_final/`. Database migrations live in `supabase/migrations/`.

See [Supabase setup and verification](README_SUPABASE.md) for configuration, API operations, and test results.
