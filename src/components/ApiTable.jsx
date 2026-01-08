import React, { useState } from "react";
import supplierMap from "../data/suppliers.json";

export default function ApiTable({ data }) {
  // Normalize input
  const responses = Array.isArray(data) ? data : data ? [data] : [];

  // 🔽 Sorting states
  const [priceSort, setPriceSort] = useState(null);   // null | "asc" | "desc"
  const [hotelSort, setHotelSort] = useState(null);   // null | "asc" | "desc"

  if (responses.length === 0) {
    return <p>No table data available</p>;
  }

  const rows = [];

  responses.forEach((response) => {
    const hotelResults = response?.AvailabilityRS?.HotelResult || [];
    const checkIn = response?.__meta?.checkIn || "N/A";
    const checkOut = response?.__meta?.checkOut || "N/A";

    hotelResults.forEach((hotel) => {
      const hotelId = hotel.HotelId;

      hotel.HotelOption.forEach((option) => {
        const optionId = option.HotelOptionId || "";
        const parts = optionId.split("|");

        const supplierCodeRaw = parts[2];
        const supplierName =
          supplierCodeRaw && supplierMap[supplierCodeRaw]
            ? supplierMap[supplierCodeRaw]
            : "oth";

        option.HotelRooms.forEach((roomGroup) => {
          roomGroup.forEach((room) => {
            const policies = room.CancellationPolicy || [];

            let freeCancelTill = "N/A";
            let freeCancelPrice = "N/A";
            let paidCancelFrom = "N/A";
            let paidCancelPrice = "N/A";

            if (policies.length === 1) {
              paidCancelFrom = policies[0].FromDate || "N/A";
              paidCancelPrice =
                policies[0].CancellationPrice !== undefined
                  ? `$${policies[0].CancellationPrice}`
                  : "N/A";
            }

            if (policies.length >= 2) {
              freeCancelTill = policies[0].ToDate || "N/A";
              freeCancelPrice =
                policies[0].CancellationPrice !== undefined
                  ? `$${policies[0].CancellationPrice}`
                  : "N/A";

              paidCancelFrom = policies[1].FromDate || "N/A";
              paidCancelPrice =
                policies[1].CancellationPrice !== undefined
                  ? `$${policies[1].CancellationPrice}`
                  : "N/A";
            }

            // New: consolidate into Refundable + Refund Info
            const isRefundable = freeCancelTill && freeCancelTill !== "N/A";
            const refundInfo = isRefundable
              ? `${freeCancelTill}${freeCancelPrice && freeCancelPrice !== "N/A" ? " — " + freeCancelPrice : ""}`
              : "-";

            rows.push({
              hotelId,
              supplierName,
              checkIn,
              checkOut,
              roomType: room.RoomTypeName,
              meal: room.MealName,
              price: room.Price,
              // status removed (we keep it in object if needed later)
              freeCancelTill,
              freeCancelPrice,
              paidCancelFrom,
              paidCancelPrice,
              refundable: isRefundable ? "Yes" : "No",
              refundInfo
            });
          });
        });
      });
    });
  });

  /* =========================
     SORTING LOGIC
  ========================= */
  const sortedRows = [...rows];

  if (hotelSort) {
    sortedRows.sort((a, b) =>
      hotelSort === "asc"
        ? Number(a.hotelId) - Number(b.hotelId)
        : Number(b.hotelId) - Number(a.hotelId)
    );
  } else if (priceSort) {
    sortedRows.sort((a, b) =>
      priceSort === "asc"
        ? Number(a.price) - Number(b.price)
        : Number(b.price) - Number(a.price)
    );
  }

  const toggleHotelSort = () => {
    setPriceSort(null);
    setHotelSort((prev) =>
      prev === null ? "asc" : prev === "asc" ? "desc" : null
    );
  };

  const togglePriceSort = () => {
    setHotelSort(null);
    setPriceSort((prev) =>
      prev === null ? "asc" : prev === "asc" ? "desc" : null
    );
  };

  const hotelArrow =
    hotelSort === "asc" ? " ▲" : hotelSort === "desc" ? " ▼" : "";

  const priceArrow =
    priceSort === "asc" ? " ▲" : priceSort === "desc" ? " ▼" : "";

  return (
    <div style={{ overflowX: "auto" }}>
      <h3>Table View</h3>

      <table className="data-table">
        <thead>
          <tr>
            <th className="sortable" onClick={toggleHotelSort}>
              HotelId{hotelArrow}
            </th>

            <th>Supplier</th>
            <th>Check-in</th>
            <th>Check-out</th>

            <th>Room Type</th>
            <th>Meal</th>

            <th className="sortable" onClick={togglePriceSort}>
              Price{priceArrow}
            </th>

            {/* Status column removed */}

            {/* New: Refundable + Refund Info */}
            <th>Refundable</th>
            <th>Refund Info</th>

            <th>Free Cancel Till</th>
            <th>Free Cancel Price</th>

            <th>Paid Cancel From</th>
            <th>Paid Cancel Price</th>
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((row, idx) => (
            <tr key={idx}>
              <td>{row.hotelId}</td>
              <td>{row.supplierName}</td>
              <td>{row.checkIn}</td>
              <td>{row.checkOut}</td>

              <td>{row.roomType}</td>
              <td>{row.meal}</td>
              <td>{row.price}</td>

              {/* status removed */}

              <td>{row.refundable}</td>
              <td>{row.refundInfo}</td>

              <td>{row.freeCancelTill}</td>
              <td>{row.freeCancelPrice}</td>

              <td>{row.paidCancelFrom}</td>
              <td>{row.paidCancelPrice}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
