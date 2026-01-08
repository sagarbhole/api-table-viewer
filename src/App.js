import React, { useState, useRef } from "react";
import ApiTable from "./components/ApiTable";
import supplierMap from "./data/suppliers.json";
import "./styles.css";

export default function App() {
  const [mode, setMode] = useState("custom");
  const [endpoint, setEndpoint] = useState("");
  const [method] = useState("POST");
  const [token, setToken] = useState("");
  const [hotelIds, setHotelIds] = useState("");
  const [dateRanges, setDateRanges] = useState([{ checkIn: "", checkOut: "" }]);
  const [body, setBody] = useState("");
  const [data, setData] = useState([]);
  const [rawJson, setRawJson] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  /* 🔥 RESIZER STATE */
  const [leftWidth, setLeftWidth] = useState(50);
  const isDragging = useRef(false);

  /* =========================
     RESIZER HANDLERS
  ========================= */
  const startDrag = () => {
    isDragging.current = true;
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const onDrag = (e) => {
    if (!isDragging.current) return;
    const newWidth = (e.clientX / window.innerWidth) * 100;
    if (newWidth > 20 && newWidth < 80) {
      setLeftWidth(newWidth);
    }
  };

  const stopDrag = () => {
    isDragging.current = false;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);
  };

  /* =========================
     HELPERS
  ========================= */
  const formatDateMMDDYYYY = (d) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${m}-${day}-${y}`;
  };

  const addDateRow = () =>
    setDateRanges([...dateRanges, { checkIn: "", checkOut: "" }]);

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
     MATRIX SUMMARY (UPDATED)
     - Now also computes Not Found per date
     - Returns requestedCount and unique found count across responses
  ========================= */
  const buildMatrixSummary = (hotelIdsStr = "") => {
    const summary = {};
    const supplierSet = new Set();
    const notFoundMap = {};
    const foundGlobalSet = new Set();

    // parse requested hotel ids into a set (strings)
    const requestedArr = (hotelIdsStr || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const requestedSet = new Set(requestedArr.map(String));
    const requestedCount = requestedSet.size;

    data.forEach((response) => {
      const dateKey = response?.__meta
        ? `${response.__meta.checkIn} → ${response.__meta.checkOut}`
        : "N/A";

      if (!summary[dateKey]) summary[dateKey] = {};

      const hotels = response?.AvailabilityRS?.HotelResult || [];
      const foundThisDateSet = new Set();

      hotels.forEach((hotel) => {
        const hotelId = String(hotel.HotelId);
        foundThisDateSet.add(hotelId);
        foundGlobalSet.add(hotelId);

        let cheapestSupplier = null;
        let cheapestPrice = Infinity;

        // Determine cheapest supplier per hotel (existing logic)
        hotel.HotelOption.forEach((opt) => {
          const supplierCode = opt.HotelOptionId?.split("|")[2];
          const supplier = supplierMap[supplierCode] || "oth";

          opt.HotelRooms.forEach((group) => {
            group.forEach((room) => {
              const price = Number(room.Price);
              if (price < cheapestPrice) {
                cheapestPrice = price;
                cheapestSupplier = supplier;
              }
            });
          });
        });

        if (cheapestSupplier) {
          supplierSet.add(cheapestSupplier);
          summary[dateKey][cheapestSupplier] =
            (summary[dateKey][cheapestSupplier] || 0) + 1;
        }
      });

      // compute not-found for this date (only if user provided hotelIds)
      let notFoundCount = 0;
      if (requestedCount > 0) {
        notFoundCount = Array.from(requestedSet).filter(
          (id) => !foundThisDateSet.has(id)
        ).length;
      } else {
        // If user didn't provide hotelIds, not-found doesn't apply — show 0
        notFoundCount = 0;
      }

      notFoundMap[dateKey] = notFoundCount;
    });

    return {
      summary,
      suppliers: Array.from(supplierSet),
      notFoundMap,
      requestedCount,
      foundUniqueCount: foundGlobalSet.size
    };
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
      const validDates = dateRanges.filter((d) => d.checkIn && d.checkOut);

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

        const res = await fetch("/api/proxy", {
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

  const { summary, suppliers, notFoundMap, requestedCount, foundUniqueCount } =
    buildMatrixSummary(hotelIds);

  return (
    <div className="app-layout">
      {/* LEFT PANE */}
      <div className="left-pane" style={{ width: `${leftWidth}%` }}>
        <div className="mode-toggle">
          <button
            className={mode === "custom" ? "active" : ""}
            onClick={() => setMode("custom")}
          >
            Custom Search
          </button>
          <button
            className={mode === "multi" ? "active" : ""}
            onClick={() => setMode("multi")}
          >
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
              <input
                value={hotelIds}
                onChange={(e) => setHotelIds(e.target.value)}
              />
            </div>

            {dateRanges.map((d, i) => (
              <div key={i} className="date-row">
                <input
                  type="date"
                  value={d.checkIn}
                  onChange={(e) =>
                    updateDate(i, "checkIn", e.target.value)
                  }
                />
                <input
                  type="date"
                  value={d.checkOut}
                  onChange={(e) =>
                    updateDate(i, "checkOut", e.target.value)
                  }
                />
                <button
                  className="remove-date"
                  onClick={() => removeDateRow(i)}
                >
                  ✕
                </button>
              </div>
            ))}

            <button onClick={addDateRow} className="secondary-btn">
              ➕ Add another date
            </button>
          </>
        )}

        <div className="input">
          <label>Request Body (JSON)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <button onClick={sendRequest} className="send-btn" disabled={loading}>
          {loading
            ? `Searching ${progress.current} / ${progress.total}`
            : "Send Request"}
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

      {/* RESIZER */}
      <div className="resizer" onMouseDown={startDrag} />

      {/* RIGHT PANE */}
      <div
        className="right-pane"
        style={{ width: `${100 - leftWidth}%` }}
      >
        <div className="response-json">
          <pre>{JSON.stringify(rawJson, null, 2)}</pre>
        </div>

        <div className="response-summary">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ margin: 0 }}>Cheapest Supplier Coverage</h4>
            <div style={{ fontSize: 13 }}>
              Found <strong>{foundUniqueCount}</strong> hotels out of <strong>{requestedCount || "—"}</strong> searched
            </div>
          </div>

          <table className="summary-matrix" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Not Found</th>
                <th>Date</th>
                {suppliers.map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary).map(([date, counts]) => {
                const supplierCounts = suppliers.map((s) => counts[s] || 0);
                const max = supplierCounts.length ? Math.max(...supplierCounts) : 0;
                return (
                  <tr key={date}>
                    <td>{notFoundMap[date] || 0}</td>
                    <td>{date}</td>
                    {suppliers.map((s) => (
                      <td
                        key={s}
                        className={counts[s] === max && max > 0 ? "cheapest-cell" : ""}
                      >
                        {counts[s] || 0}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="response-table">
          <ApiTable data={data} />
        </div>
      </div>
    </div>
  );
}
