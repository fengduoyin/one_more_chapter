import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function SelectMenu({ className = "", value, onChange, options, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const listId = useId();
  const selected =
    options.find((option) => String(option.value) === String(value)) ??
    options.find((option) => !option.disabled) ??
    options[0];

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuStyle(null);
      return;
    }

    function updatePosition() {
      const rect = rootRef.current.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function onDocumentClick(event) {
      if (!rootRef.current?.contains(event.target) && !event.target.closest(".selectMenuListPortal")) {
        setOpen(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menu =
    open && menuStyle ? (
      <ul
        className="selectMenuList selectMenuListPortal"
        id={listId}
        role="listbox"
        style={menuStyle}
      >
        {options.map((option) => {
          const isActive = String(option.value) === String(value);
          const isDisabled = Boolean(option.disabled);
          return (
            <li key={String(option.value)} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={isDisabled}
                className={[
                  "selectMenuOption",
                  isActive ? "selectMenuOption--active" : "",
                  isDisabled ? "selectMenuOption--disabled" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  if (isDisabled) return;
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={["selectMenu", open ? "selectMenu--open" : "", className].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className="selectMenuTrigger input"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="selectMenuValue">{selected?.label ?? "—"}</span>
        <span className="selectMenuChevron" aria-hidden="true" />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
