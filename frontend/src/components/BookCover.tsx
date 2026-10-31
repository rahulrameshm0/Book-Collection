import { useEffect, useState } from "react";

type Props = {
  src: string;
  title: string;
  className?: string;
};

function initials(title: string) {
  return (
    title
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "?"
  );
}

export default function BookCover({ src, title, className = "" }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div className={`book__cover ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="book__fallback" aria-hidden="true">
          <span>{initials(title)}</span>
          <small>{title}</small>
        </div>
      )}
    </div>
  );
}
