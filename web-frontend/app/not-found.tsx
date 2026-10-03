import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h1>Page not found</h1>
      <p>Sorry, we could not find what you were looking for.</p>
      <p>
        <Link href="/">Back to rooms</Link>
      </p>
    </div>
  );
}
