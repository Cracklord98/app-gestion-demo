import { displayCountry, getCountryFlagUrl } from "../utils/statusLabels";

interface CountryFlagProps {
  country: string | null | undefined;
  showName?: boolean;
  size?: number;
}

export function CountryFlag({ country, showName = true, size = 20 }: CountryFlagProps) {
  const flagUrl = getCountryFlagUrl(country);
  const name = displayCountry(country);
  const height = Math.round(size * 0.75);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
      {flagUrl ? (
        <img
          src={flagUrl}
          alt={`${name} flag`}
          width={size}
          height={height}
          style={{
            borderRadius: "2px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            objectFit: "cover",
            flexShrink: 0,
          }}
          loading="lazy"
        />
      ) : (
        <span style={{ fontSize: `${size * 0.8}px` }}>🌐</span>
      )}
      {showName && <span>{name}</span>}
    </span>
  );
}
