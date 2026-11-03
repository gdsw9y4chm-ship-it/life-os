import crystal from "../assets/rose-crystal.svg?url";
import wings from "../assets/angel-feather-wings.webp?url";
export function AngelWings({ className = "" }: { className?: string }) {
  return (
    <img
      className={`angel-wings ${className}`}
      src={wings}
      alt=""
      aria-hidden="true"
      width="520"
      height="300"
    />
  );
}
export function Diamond({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`diamond ${className}`}
      width="28"
      height="24"
      viewBox="0 0 28 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 8 8 2h12l6 6-12 14L2 8Z"
        fill="currentColor"
        fillOpacity=".08"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M2 8h24M8 2l6 20L20 2M8 2l6 6 6-6"
        stroke="currentColor"
        strokeWidth=".8"
      />
    </svg>
  );
}

export function Crystal({ className = "" }: { className?: string }) {
  return <img className={`crystal ${className}`} src={crystal} width="72" height="60" alt="" aria-hidden="true" />;
}
