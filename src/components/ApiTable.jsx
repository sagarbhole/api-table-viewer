import React, { useState } from "react";
import supplierMap from "../data/suppliers.json";

export default function ApiTable({ data }) {
  const responses = Array.isArray(data) ? data : data ? [data] : [];

  const [priceSort, setPriceSort] = useState(null);
  const [hotelSort, setHotelSort] = useState(null);

  if (responses.length === 0) return <p>No table data available</p>;

  const formatDateDDMMYYYY = (d) => {
    if (!d || d === "N/A") return "N/A";
    const [y, m, day] = d.split("-");
    return `${day}-${m}-${y}`;
  };

  const rows = [];

  responses.forEach((response) => {
    const hotelResults = response?.AvailabilityRS?.HotelResult || [];
    const checkIn = formatDateDDMMYYYY(response?.__meta?.checkIn);
    const checkOut = formatDateDDMMYYYY(response?.__meta?.checkOut);

    hotelResults.forEach((hotel) => {
      const hotelId = hotel.HotelId;

      hotel.HotelOption.forEach((option) => {
        const parts = (option.HotelOptionId || "").split("|");
        const supplierCodeRaw = parts[2];
        const supplierName = supplierMap[supplierCodeRaw] || "oth";

        option.HotelRooms.forEach((roomGroup) => {
          roomGroup.forEach((room) => {
            rows.push({
              hotelId,
              supplierName,
              checkIn,
              checkOut,
              roomType: room.RoomTypeName,
              meal: room.MealName,
              price: room.Price
            });
          });
        });
      });
    });
  });

  const sortedRows = [...rows];

  if (hotelSort) {
    sortedRows.sort((a, b) =>
      hotelSort === "asc" ? a.hotelId - b.hotelId : b.hotelId - a.hotelId
    );
  } else if (priceSort) {
    sortedRows.sort((a, b) =>
      priceSort === "asc" ? a.price - b.price : b.price - a.price
    );
  }

  const hotelArrow =
    hotelSort === "asc" ? " ▲" : hotelSort === "desc" ? " ▼" : "";
  const priceArrow =
    priceSort === "asc" ? " ▲" : priceSort === "desc" ? " ▼" : "";

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th onClick={() => setHotelSort(hotelSort === "asc" ? "desc" : "asc")}>
            HotelId{hotelArrow}
          </th>
          <th>Supplier</th>
          <th>Check-in</th>
          <th>Check-out</th>
          <th>Room Type</th>
          <th>Meal</th>
          <th onClick={() => setPriceSort(priceSort === "asc" ? "desc" : "asc")}>
            Price{priceArrow}
          </th>
        </tr>
      </thead>

      <tbody>
        {sortedRows.map((row, i) => (
          <tr key={i}>
            <td>{row.hotelId}</td>
            <td>{row.supplierName}</td>
            <td>{row.checkIn}</td>
            <td>{row.checkOut}</td>
            <td>{row.roomType}</td>
            <td>{row.meal}</td>
            <td>{row.price}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
