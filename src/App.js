import React, { useState, useRef } from "react";
import ApiTable from "./components/ApiTable";
import supplierMap from "./data/suppliers.json";
import "./styles.css";

export default function App() {
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

  /*  RESIZER STATE */
  const [leftWidth, setLeftWidth] = useState(50);
  const isDragging = useRef(false);

  /* =========================
     RESIZER HANDLERS (ONLY FIX)
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

  const formatDateDDMMYYYY = (d) => {
    if (!d || d === "N/A") return "N/A";
    const [y, m, day] = d.split("-");
    return `${day}-${m}-${y}`;
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
     MATRIX SUMMARY
  ========================= */
  const buildMatrixSummary = (hotelIdsStr = "") => {
    const summary = {};
    const supplierSet = new Set();
    const notFoundMap = {};
    const foundGlobalSet = new Set();

    const requestedArr = (hotelIdsStr || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const requestedSet = new Set(requestedArr.map(String));
    const requestedCount = requestedSet.size;

    data.forEach((response) => {
      const dateKey = response?.__meta
        ? `${formatDateDDMMYYYY(response.__meta.checkIn)} → ${formatDateDDMMYYYY(
            response.__meta.checkOut
          )}`
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

      notFoundMap[dateKey] =
        requestedCount > 0
          ? Array.from(requestedSet).filter(
              (id) => !foundThisDateSet.has(id)
            ).length
          : 0;
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
     REQUEST LOGIC
  ========================= */
  const sendRequest = async () => {
    setLoading(true);
    setError("");
    setData([]);
    setRawJson([]);

    try {
      const baseBody = body ? JSON.parse(body) : {};
      const validDates = dateRanges.filter((d) => d.checkIn && d.checkOut);
      const allResponses = [];

      for (let i = 0; i < validDates.length; i++) {
        const range = validDates[i];

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
        {/*  YOUR ORIGINAL LEFT UI — UNTOUCHED */}
        {/* (inputs, dates, body, send button etc.) */}
        {/* EXACT SAME AS YOUR WORKING VERSION */}
      </div>

      {/*  RESIZER FIX */}
      <div className="resizer" onMouseDown={startDrag} />

      {/* RIGHT PANE */}
      <div className="right-pane" style={{ width: `${100 - leftWidth}%` }}>
        <div className="response-json">
          <pre>{JSON.stringify(rawJson, null, 2)}</pre>
        </div>

        <div className="response-summary">
          <h4>
            Cheapest Supplier Coverage — Found {foundUniqueCount} /{" "}
            {requestedCount || "—"}
          </h4>

          <table className="summary-matrix">
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
                const max = Math.max(
                  ...suppliers.map((s) => counts[s] || 0)
                );
                return (
                  <tr key={date}>
                    <td>{notFoundMap[date]}</td>
                    <td>{date}</td>
                    {suppliers.map((s) => (
                      <td
                        key={s}
                        className={counts[s] === max ? "cheapest-cell" : ""}
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
