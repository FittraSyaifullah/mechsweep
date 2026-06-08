interface IconProps {
  className?: string;
}

export function LogoMark({ className = "h-8 w-8" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-mech-600" />
      <path
        d="M8 20V12h3.2l2.4 5.2L16 12h3.2v8h-2.1v-4.8L14.8 20h-1.6l-2.3-4.8V20H8zm10.4 0V12h5.6c1.5 0 2.6.4 3.3 1.2.7.8 1.1 1.9 1.1 3.3 0 1.4-.4 2.5-1.1 3.3-.7.8-1.8 1.2-3.3 1.2H18.4zm2.1-1.7h3.1c.8 0 1.4-.2 1.8-.7.4-.5.6-1.2.6-2.1 0-.9-.2-1.6-.6-2.1-.4-.5-1-.7-1.8-.7h-3.1V18.3z"
        fill="white"
      />
    </svg>
  );
}

export function SearchIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function UploadIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M9.25 2.567a.75.75 0 01.75 0l4.5 2.598a.75.75 0 11-.75 1.299L10 4.832 5.75 7.464a.75.75 0 11-.75-1.3l4.5-2.597z" />
      <path d="M4.5 9.75a.75.75 0 01.75.75v3.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-3.5a.75.75 0 011.5 0v3.5A2.25 2.25 0 0114.25 16h-8.5A2.25 2.25 0 013.75 13.75v-3.5a.75.75 0 01.75-.75z" />
      <path d="M10 6.75a.75.75 0 01.75.75v6.19l1.72-1.72a.75.75 0 111.06 1.06l-3 3a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06l1.72 1.72V7.5A.75.75 0 0110 6.75z" />
    </svg>
  );
}

export function GlobeIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ExportIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
      <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
    </svg>
  );
}

export function CloseIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

export function FilePdfIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function FileTextIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm4 1h6v4h-6V5zm0 6h6v2h-6v-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function FileCsvIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2.5 5.5a.75.75 0 000 1.5h1.25v1.25a.75.75 0 001.5 0V11h1.25a.75.75 0 000-1.5H9.25V8.25a.75.75 0 00-1.5 0V9.5H6.5z" />
    </svg>
  );
}

export function Spinner({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.875a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function GridIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M4 4a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1V5a1 1 0 00-1-1H4zm8 0a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1V5a1 1 0 00-1-1h-2zm-8 8a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 00-1-1H4zm8 0a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 00-1-1h-2z" />
    </svg>
  );
}

export function ListIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 5.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function DocTypeIcon({ type, className = "h-5 w-5" }: IconProps & { type: "pdf" | "txt" | "csv" }) {
  if (type === "pdf") return <FilePdfIcon className={className} />;
  if (type === "csv") return <FileCsvIcon className={className} />;
  return <FileTextIcon className={className} />;
}
