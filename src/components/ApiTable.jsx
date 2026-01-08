import React, { useState } from "react";
import supplierMap from "../data/suppliers.json";

export default function ApiTable({ data }) {
  const responses = Array.isArray(data) ? data : data ? [data] : [];

  const [priceSort, setPriceSort] = useState(null);
  const [hotelSort, setHotelSort] = useState(null);

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
        const parts = (option.HotelOptionId || "").split("|");
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

            if (policies.length >= 2) {
              freeCancelTill = policies[0].ToDate || "N/A";
              freeCancelPrice =
                policies[0].CancellationPrice !== undefined
                  ? `$${policies[0].CancellationPrice}`
                  : "N/A";
            }

            const isRefundable = freeCancelTill !== "N/A";
            const refundInfo = isRefundable
              ? `${freeCancelTill}${
                  freeCancelPrice !== "N/A" ? " — " + freeCancelPrice : ""
                }`
              : "-";

            rows.push({
              hotelId,
              supplierName,
              checkIn,
              checkOut,
              roomType: room.RoomTypeName,
              meal: room.MealName,
              price: room.Price,
              refundable: isRefundable ? "Yes" : "No",
              refundInfo
            });
          });
        });
      });
    });
  });

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

  return (
    <div style={{ overflowX: "auto" }}>
      <h3>Table View</h3>

      <table className="data-table">
        <thead>
          <tr>
            <th className="sortable" onClick={toggleHotelSort}>
              HotelId
            </th>
            <th>Supplier</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Room Type</th>
            <th>Meal</th>
            <th className="sortable" onClick={togglePriceSort}>
              Price
            </th>
            <th>Refundable</th>
            <th>Refund Info</th>
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
              <td>{row.refundable}</td>
              <td>{row.refundInfo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
