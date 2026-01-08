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
  const [dateRanges, setDateRanges] = useState([{ checkIn: "", checkOut: "" }]);
  const [body, setBody] = useState("");
  const [data, setData] = useState([]);
  const [rawJson, setRawJson] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const [expandedDates, setExpandedDates] = useState({});

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
     SUMMARY MATRIX BUILDER
     (COUNTS OF CHEAPEST SUPPLIER)
  ========================= */
  const buildMatrixSummary = () => {
    const summary = {};
    const supplierSet = new Set();

    data.forEach((response) => {
      const dateKey = response?.__meta
        ? `${response.__meta.checkIn} → ${response.__meta.checkOut}`
        : "N/A";

      if (!summary[dateKey]) summary[dateKey] = {};

      const hotels = response?.AvailabilityRS?.HotelResult || [];

      hotels.forEach((hotel) => {
        let cheapestSupplier = null;
        let cheapestPrice = Infinity;

        hotel.HotelOption.forEach((opt) => {
          const supplierCode = opt.HotelOptionId?.split("|")[2];
          const supplier =
            supplierMap[supplierCode] || "oth";

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
    });

    return {
      summary,
      suppliers: Array.from(supplierSet)
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

  const { summary, suppliers } = buildMatrixSummary();

  return (
    <div className="app-layout">
      <div className="left-pane">
        {/* LEFT PANE UNCHANGED */}
      </div>

      <div className="right-pane">
        <div className="response-json">
          <pre>{JSON.stringify(rawJson, null, 2)}</pre>
        </div>

        {/* 🔥 MATRIX SUMMARY */}
        <div className="response-summary">
          <h4>Cheapest Supplier Coverage</h4>

          <table className="summary-matrix">
            <thead>
              <tr>
                <th>Date</th>
                {suppliers.map((s) => (
                  <th key={s}>{s}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary).map(([date, counts]) => {
                const max = Math.max(...Object.values(counts));
                return (
                  <React.Fragment key={date}>
                    <tr>
                      <td>{date}</td>
                      {suppliers.map((s) => (
                        <td
                          key={s}
                          className={
                            counts[s] === max ? "cheapest-cell" : ""
                          }
                        >
                          {counts[s] || 0}
                        </td>
                      ))}
                      <td>
                        <button
                          className="expand-btn"
                          onClick={() =>
                            setExpandedDates((p) => ({
                              ...p,
                              [date]: !p[date]
                            }))
                          }
                        >
                          {expandedDates[date] ? "−" : "+"}
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
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
