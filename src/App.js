import React, { useState } from "react";
import ApiTable from "./components/ApiTable";
import supplierMap from "./data/suppliers.json";
import "./styles.css";

export default function App() {
  const [mode, setMode] = useState("custom");

  const [endpoint, setEndpoint] = useState("");
  const [method] = useState("POST");
  const [token, setToken] = useState("");

  const [hotelIds, setHotelIds] = useState("");

  const [dateRanges, setDateRanges] = useState([
    { checkIn: "", checkOut: "" }
  ]);

  const [body, setBody] = useState("");
  const [data, setData] = useState([]);
  const [rawJson, setRawJson] = useState([]);
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  /* =========================
     HELPERS
  ========================= */
  const formatDateMMDDYYYY = (d) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${m}-${day}-${y}`;
  };

  const addDateRow = () => {
    setDateRanges([...dateRanges, { checkIn: "", checkOut: "" }]);
  };

  const removeDateRow = (index) => {
    if (dateRanges.length === 1) return;
    setDateRanges(dateRanges.filter((_, i) => i !== index));
  };

  const updateDate = (index, field, value) => {
    const copy = [...dateRanges];
    copy[index][field] = value;
    setDateRanges(copy);
  };

  /* =========================
     SUMMARY BUILDER (UPDATED)
  ========================= */
  const buildSummary = () => {
    const summary = {};

    data.forEach((response) => {
      const meta = response?.__meta;
      const dateLabel = meta
        ? `${meta.checkIn} → ${meta.checkOut}`
        : "N/A";

      const hotels = response?.AvailabilityRS?.HotelResult || [];

      hotels.forEach((hotel) => {
        if (!summary[hotel.HotelId]) {
          summary[hotel.HotelId] = {
            dates: new Set(),
            suppliers: new Set()
          };
        }

        summary[hotel.HotelId].dates.add(dateLabel);

        hotel.HotelOption.forEach((opt) => {
          const parts = (opt.HotelOptionId || "").split("|");
          const supplierCode = parts[2];
          const supplierName =
            supplierCode && supplierMap[supplierCode]
              ? supplierMap[supplierCode]
              : "oth";

          summary[hotel.HotelId].suppliers.add(supplierName);
        });
      });
    });

    return Object.entries(summary).map(([hotelId, info]) => ({
      hotelId,
      dates: Array.from(info.dates),
      suppliers: Array.from(info.suppliers)
    }));
  };

  /* =========================
     REQUEST LOGIC (UNCHANGED)
  ========================= */
  const sendRequest = async () => {
    setLoading(true);
    setError("");
    setData([]);
    setRawJson([]);

    try {
      const baseBody = body ? JSON.parse(body) : {};

      if (mode === "custom") {
        const res = await fetch("http://localhost:5000/api/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: endpoint,
            method,
            headers: token ? { Authorization: token } : {},
            body: baseBody
          })
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.Error?.[0]?.description);

        setRawJson([json]);
        setData([json]);
        return;
      }

      const validDates = dateRanges.filter(
        (d) => d.checkIn && d.checkOut
      );

      setProgress({ current: 0, total: validDates.length });

      const allResponses = [];

      for (let i = 0; i < validDates.length; i++) {
        const range = validDates[i];
        setProgress({ current: i + 1, total: validDates.length });

        const reqBody = JSON.parse(JSON.stringify(baseBody));

        reqBody.Request = {
          ...reqBody.Request,
          CheckInDate: formatDateMMDDYYYY(range.checkIn),
          CheckOutDate: formatDateMMDDYYYY(range.checkOut),
          Filters: {
            ...reqBody.Request?.Filters,
            HotelIDs: hotelIds
          }
        };

        const res = await fetch("http://localhost:5000/api/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: endpoint,
            method,
            headers: token ? { Authorization: token } : {},
            body: reqBody
          })
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.Error?.[0]?.description);

        json.__meta = {
          checkIn: range.checkIn,
          checkOut: range.checkOut
        };

        allResponses.push(json);
      }

      setRawJson(allResponses);
      setData(allResponses);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const summary = buildSummary();

  return (
    <div className="app-layout">
      {/* LEFT PANE */}
      <div className="left-pane">
        <div className="mode-toggle">
          <button className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}>
            Custom Search
          </button>
          <button className={mode === "multi" ? "active" : ""} onClick={() => setMode("multi")}>
            Multi Search
          </button>
        </div>

        <div className="input">
          <label>API Endpoint</label>
          <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
        </div>

        <div className="input">
          <label>Authorization Token</label>
          <input value={token} onChange={(e) => setToken(e.target.value)} />
        </div>

        {mode === "multi" && (
          <>
            <div className="input">
              <label>Hotel IDs (comma separated)</label>
              <input value={hotelIds} onChange={(e) => setHotelIds(e.target.value)} />
            </div>

            {dateRanges.map((d, i) => (
              <div key={i} className="date-row">
                <input type="date" value={d.checkIn} onChange={(e) => updateDate(i, "checkIn", e.target.value)} />
                <input type="date" value={d.checkOut} onChange={(e) => updateDate(i, "checkOut", e.target.value)} />
                <button className="remove-date" onClick={() => removeDateRow(i)}>✕</button>
              </div>
            ))}

            <button onClick={addDateRow} className="secondary-btn">➕ Add another date</button>
          </>
        )}

        <div className="input">
          <label>Request Body (JSON)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        <button onClick={sendRequest} className="send-btn" disabled={loading}>
          {loading ? `Searching ${progress.current} / ${progress.total}` : "Send Request"}
        </button>

        {loading && (
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width:
                  progress.total > 0
                    ? `${(progress.current / progress.total) * 100}%`
                    : "0%"
              }}
            />
          </div>
        )}

        {error && <div className="error-box">{error}</div>}
      </div>

      {/* RIGHT PANE */}
      <div className="right-pane">
        <div className="response-json">
          <pre>{JSON.stringify(rawJson, null, 2)}</pre>
        </div>

        {/* 🔍 ENHANCED SUMMARY */}
        <div className="response-summary">
          <h4>Response Summary</h4>

          {summary.map((s) => (
            <div key={s.hotelId} className="summary-card">
              <strong>Hotel {s.hotelId}</strong>

              <div className="summary-section">
                <span>Dates:</span>
                <ul>
                  {s.dates.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>

              <div className="summary-section">
                <span>Suppliers ({s.suppliers.length}):</span>
                <ul>
                  {s.suppliers.map((sup) => (
                    <li key={sup}>{sup}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="response-table">
          <ApiTable data={data} />
        </div>
      </div>
    </div>
  );
}
