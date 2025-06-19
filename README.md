# Credit Card Advisor

## Setup

### Backend
1. Navigate to `backend` folder.
2. Create a Python virtual environment: `python3 -m venv venv` (or `python -m venv venv`)
3. Activate it: `source venv/bin/activate` (macOS/Linux) or `venv\Scripts\activate` (Windows)
4. Install dependencies: `pip install -r requirements.txt`
5. Copy the `.env` file and fill in your Together API key.
6. Run the server: `uvicorn main:app --reload --host 0.0.0.0 --port 8000`

### Frontend
1. Navigate to `frontend` folder.
2. Install dependencies: `npm install`
3. Start the app: `npm start`
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage
- Interact with the chat interface to receive personalized credit card recommendations.

