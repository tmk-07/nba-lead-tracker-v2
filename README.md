# NBA Lead Tracker v2

This version uses two team autocomplete boxes. Pick Team 1 and Team 2, then it loads the 10 most recent games between them.

## Run backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip setuptools wheel
python3 -m pip install -r requirements.txt
python3 -m uvicorn main:app --reload --port 8000
```

## Run frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.
