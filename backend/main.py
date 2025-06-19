from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import json, re

app = FastAPI()

# Enable CORS for React dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the cards database
DATA_PATH = Path(__file__).parent / "data" / "cards.json"
with open(DATA_PATH) as f:
    CARD_DB = json.load(f)

# Q&A flow questions
QUESTIONS = [
    ("income",       "What's your monthly income in ₹? (e.g. 50000 or 60k)"),
    ("fuel_pct",     "What % of your spending goes on fuel?"),
    ("grocery_pct",  "And what % goes to groceries?"),
    ("dining_pct",   "Dining & entertainment %?"),
    ("travel_pct",   "Travel (flights, hotels) %?"),
    ("preference",   "Which benefit matters most—cashback, miles, or lounges?"),
    ("existing",     "Do you already hold any credit cards? (yes/no)"),
    ("credit_score", "Your credit-score range? (e.g. 650-700). If unknown, reply 'unknown'.")
]

# In-memory sessions
sessions: dict[str, dict] = {}

class ChatRequest(BaseModel):
    session_id: str
    message:    str

class CardReco(BaseModel):
    name: str
    issuer: str
    annual_fee: int
    eligibility_min_income: int
    eligibility_min_score: int
    rewards: dict[str, float]
    perks: list[str]

class ChatResponse(BaseModel):
    reply: str | None = None
    recommendations: list[CardReco] | None = None

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    state = sessions.setdefault(
        req.session_id,
        {"current_q": 0, "answers": {k: None for k, _ in QUESTIONS}}
    )
    idx = state["current_q"]

    # If we’re replying to a previous question, validate/save the answer
    if 0 < idx <= len(QUESTIONS):
        key, _ = QUESTIONS[idx - 1]
        ans = req.message.strip()
        # Validate preference
        if key == "preference":
            if ans.lower() not in ("cashback", "miles", "lounges", "lounge"):
                return ChatResponse(reply=QUESTIONS[idx - 1][1])
            state["answers"][key] = ans
        # Validate existing
        elif key == "existing":
            if ans.lower() not in ("yes", "no"):
                return ChatResponse(reply=QUESTIONS[idx - 1][1])
            state["answers"][key] = ans
        # Validate credit_score
        elif key == "credit_score":
            if not _is_valid_score(ans):
                return ChatResponse(reply=QUESTIONS[idx - 1][1])
            state["answers"][key] = ans
        else:
            state["answers"][key] = ans

    # If more questions remain, ask the next one
    if idx < len(QUESTIONS):
        _, question_text = QUESTIONS[idx]
        state["current_q"] += 1
        return ChatResponse(reply=question_text)

    # All inputs collected → build recommendations
    recs = _recommend(state["answers"])
    sessions.pop(req.session_id, None)
    if not recs:
        return ChatResponse(reply="Sorry, no cards match your profile.")
    return ChatResponse(recommendations=recs)


def _is_valid_score(text: str) -> bool:
    t = text.lower().strip()
    if t in ("unknown", ""):
        return True
    if re.match(r"^\d{2,3}\s*-\s*\d{2,3}$", t):
        return True
    if t.isdigit():
        return True
    return False


def _parse_income(text: str) -> int:
    s = text.lower().replace(",", "").strip()
    if m := re.match(r"([\d\.]+)k\b", s):
        return int(float(m.group(1)) * 1_000)
    if m := re.match(r"([\d\.]+)\s*lakh", s):
        return int(float(m.group(1)) * 100_000)
    if m := re.search(r"[\d\.]+", s):
        return int(float(m.group(0)))
    raise ValueError

def _parse_score(text: str) -> int | None:
    t = text.lower().strip()
    if t in ("unknown",""):
        return None
    if m := re.match(r"(\d{2,3})\s*-\s*(\d{2,3})", t):
        return int(m.group(1))
    if t.isdigit():
        return int(t)
    raise ValueError

def _recommend(ans: dict[str,str]) -> list[dict]:
    try:
        income = _parse_income(ans["income"])
        score  = _parse_score(ans["credit_score"])
    except:
        return []

    # Filter eligibility
    elig = [
        c for c in CARD_DB
        if income >= c["eligibility_min_income"]
        and (score is None or score >= c["eligibility_min_score"])
    ]
    # Rank by preference
    pref = ans["preference"].lower()
    if pref == "cashback":
        elig.sort(key=lambda c: c["rewards"].get("all_spends_cashback_pct",0), reverse=True)
    elif pref == "miles":
        elig.sort(key=lambda c: c["rewards"].get("travel_miles_pct",0), reverse=True)
    elif "lounge" in pref:
        elig.sort(key=lambda c: sum("lounge" in p.lower() for p in c["perks"]), reverse=True)
    else:
        elig.sort(key=lambda c: c.get("annual_fee",0))

    top = elig[:3]
    return top
