import React from "react";

export default function BookCoverThumb({ book, className = "" }) {
  return (
    <div className={`bookCoverThumb ${className}`.trim()}>
      {book.cover_url ? (
        <img src={book.cover_url} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className="coverStub">—</div>
      )}
    </div>
  );
}
