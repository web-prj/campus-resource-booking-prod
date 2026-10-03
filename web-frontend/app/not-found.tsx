import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>Page not found</h1>
      <p>We could not find what you were looking for.</p>
      <Link href="/" className="button-primary">
        Back to spaces
      </Link>
    </div>
  );
}
