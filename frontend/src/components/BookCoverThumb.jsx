import React, { useEffect, useRef, useState } from "react";
import { sampleCoverDominantColor } from "../coverColor.js";

/** Matches CSS `.bookTileCoverWrap { aspect-ratio: 2 / 3 }` */
const COVER_CELL_ASPECT = 2 / 3;

function coverSrc(book) {
  if (!book?.cover_url) return null;
  const stamp = book.updated_at || book.id;
  const join = book.cover_url.includes("?") ? "&" : "?";
  return `${book.cover_url}${join}v=${encodeURIComponent(`${book.id}-${stamp}`)}`;
}

export default function BookCoverThumb({ book, className = "" }) {
  const imgRef = useRef(null);
  const [sideColor, setSideColor] = useState(null);
  const [fitClass, setFitClass] = useState("");
  const src = coverSrc(book);

  function applyCoverPresentation(image) {
    if (!image?.naturalWidth || !image.naturalHeight) return;
    const aspect = image.naturalWidth / image.naturalHeight;
    // Wider than the cell: fill height via object-fit:cover (sides clipped inside the box).
    // Narrower: fill height with width:auto and pad sides with dominant color.
    setFitClass(aspect > COVER_CELL_ASPECT ? "coverFitWide" : "coverFitNarrow");
    setSideColor(aspect > COVER_CELL_ASPECT ? null : sampleCoverDominantColor(image));
  }

  useEffect(() => {
    setSideColor(null);
    setFitClass("");
    const image = imgRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      applyCoverPresentation(image);
    }
  }, [src]);

  return (
    <div
      className={`bookCoverThumb ${className}`.trim()}
      style={sideColor ? { backgroundColor: sideColor } : undefined}
    >
      {src ? (
        <img
          ref={imgRef}
          key={src}
          className={fitClass}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={(event) => applyCoverPresentation(event.currentTarget)}
        />
      ) : (
        <div className="coverStub">—</div>
      )}
    </div>
  );
}
