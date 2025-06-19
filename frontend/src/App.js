// frontend/src/App.js
import React, { useState, useEffect, useRef } from "react";

// Renders a text message or a card bubble inline
function Message({ msg }) {
  if (msg.type === "card") {
    const { card } = msg;
    const entries = Object.entries(card.rewards || {});
    const [bestKey, bestVal] = entries.reduce(
      (m, c) => (c[1] > m[1] ? c : m),
      entries[0] || ["", 0]
    );
    const reasonText = (() => {
      if (bestKey.includes("travel_miles")) return `Strong travel miles rate of ${bestVal}%`;
      if (bestKey.includes("grocery_cashback")) return `Great grocery cashback of ${bestVal}%`;
      if (bestKey.includes("dining_cashback"))  return `Excellent dining cashback of ${bestVal}%`;
      if (bestKey.includes("fuel_cashback"))    return `High fuel cashback of ${bestVal}%`;
      if (bestKey.includes("all_spends_cashback")) return `Flat cashback on all spends at ${bestVal}%`;
      return `Reward rate of ${bestVal}%`;
    })();

    return (
      <div className="w-full flex justify-start my-2">
        <div className="inline-block bg-white shadow-lg p-4 rounded max-w-xl">
          {card.image_url && (
            <img
              src={card.image_url}
              alt={card.name}
              className="w-full h-32 object-cover rounded mb-2"
            />
          )}
          <h3 className="font-bold text-lg mb-1">{card.name}</h3>
          {card.fee != null && (
            <p className="text-xs text-gray-500 mb-1">Fee: ₹{card.fee}/yr</p>
          )}
          {card.rewards && (
            <p className="text-sm mb-1">
              <strong>Rewards:</strong>{" "}
              {entries.map(([k, v]) => `${k.replace(/_/g, " ")} ${v}%`).join(", ")}
            </p>
          )}
          {card.perks && (
            <p className="text-sm mb-1">
              <strong>Perks:</strong> {card.perks.join(", ")}
            </p>
          )}
          <p className="mt-2 text-gray-700">
            <strong>Reason:</strong> {reasonText}
          </p>
          {card.reward_simulation && (
            <p className="mt-1 font-semibold text-gray-800">
              {card.reward_simulation}
            </p>
          )}
        </div>
      </div>
    );
  }

  const align = msg.from === "bot" ? "justify-start" : "justify-end";
  const bg    = msg.from === "bot" ? "bg-white shadow-lg" : "bg-blue-500 text-white";
  return (
    <div className={`w-full flex ${align} my-2`}>
      <span className={`inline-block p-3 rounded whitespace-pre-wrap max-w-xs ${bg}`}>
        {msg.text}
      </span>
    </div>
  );
}

export default function App() {
  const [sessionId] = useState(() => Date.now().toString());
  const [msgs, setMsgs] = useState([
    {
      type: "text",
      from: "bot",
      text: "Hello! I’m your Credit Card Advisor. Let’s start with your profile."
    }
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // Determine if last bot message requires numeric input
  const lastBot = [...msgs].reverse().find(m => m.from === "bot" && m.type === "text");
  const needsNumber = lastBot && /(income|%)/i.test(lastBot.text);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Validate numeric if needed
    if (needsNumber) {
      const num = Number(input);
      if (isNaN(num) || num < 0 || (lastBot.text.includes("%") && num > 100)) {
        // re-ask the same question
        setMsgs(ms => [...ms, lastBot]);
        setInput("");
        return;
      }
    }

    // Echo user
    setMsgs(ms => [...ms, { type: "text", from: "user", text: input }]);
    const txt = input;
    setInput("");

    // Backend call
    const res = await fetch("http://localhost:8000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message: txt })
    });
    if (!res.ok) {
      setMsgs(ms => [...ms, { type: "text", from: "bot", text: "Oops, something went wrong." }]);
      return;
    }
    const data = await res.json();

    // Inject cards if present
    if (data.recommendations) {
      setMsgs(ms => [
        ...ms,
        ...data.recommendations.map(c => ({ type: "card", card: c }))
      ]);
      return;
    }

    // Next question or repeat on validation failure
    if (data.reply) {
      setMsgs(ms => [...ms, { type: "text", from: "bot", text: data.reply }]);
    } else {
      setMsgs(ms => [...ms, lastBot]);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-start max-w-xl mx-auto">
        {msgs.map((m,i) => <Message key={i} msg={m} />)}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 max-w-xl mx-auto flex gap-2">
        <input
          type={needsNumber ? "number" : "text"}
          inputMode={needsNumber ? "numeric" : "text"}
          pattern={needsNumber ? "[0-9]*" : undefined}
          className="flex-grow p-2 border rounded"
          placeholder="Type your answer…"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Send</button>
      </form>
    </div>
  );
}
