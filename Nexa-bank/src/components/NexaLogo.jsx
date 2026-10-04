/** Shared Nexa wordmark and monogram. */
export function NexaLogo({ size = "md", showName = true, className = "" }) {
  const dimensions = {
    sm: { box: "h-8 w-8 rounded-[11px]", glyph: "h-[19px] w-[19px]", text: "text-[15px]" },
    md: { box: "h-10 w-10 rounded-[14px]", glyph: "h-6 w-6", text: "text-[17px]" },
    lg: { box: "h-12 w-12 rounded-[16px]", glyph: "h-7 w-7", text: "text-[18px]" },
  }[size] ?? { box: "h-10 w-10 rounded-[14px]", glyph: "h-6 w-6", text: "text-[17px]" };

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className={`grid shrink-0 place-items-center bg-[#b8f36b] text-[#14200d] shadow-[0_5px_24px_-10px_rgba(184,243,107,0.75)] ${dimensions.box}`}>
        <svg className={dimensions.glyph} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M7.5 24.5V9.1c0-1.8 2.3-2.6 3.4-1.2l10.2 13.2c1.1 1.4 3.4.6 3.4-1.2V7.5"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24.5" cy="7.5" r="2" fill="currentColor" />
        </svg>
      </span>
      {showName && (
        <span className={`whitespace-nowrap font-semibold tracking-[-0.055em] text-white ${dimensions.text}`}>
          Nexa<span className="ml-1 font-normal tracking-[-0.045em] text-white/50">Bank</span>
        </span>
      )}
    </span>
  );
}
