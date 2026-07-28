import { ArrowRight, BookOpen, Code2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { site } from "@/lib/site";

export default function HomePage() {
  return (
    <main className="docs-home">
      <nav className="home-nav" aria-label="Primary navigation">
        <Link href="/" className="home-brand">
          <span className="home-brand-mark">O</span>
          <span>OpenTrip Docs</span>
        </Link>
        <a href={site.product} className="home-product-link">
          Open OpenTrip <ExternalLink size={14} aria-hidden="true" />
        </a>
      </nav>

      <section className="home-hero">
        <p className="home-eyebrow">One trip, two ways to learn</p>
        <h1>Start with what you want to do.</h1>
        <p>
          Find practical guidance for planning a trip — including Today,
          reservations, map and street view, WeChat, and the AI companion — or
          go behind the scenes to understand and build OpenTrip.
        </p>
      </section>

      <section className="perspective-cards" aria-label="Documentation perspectives">
        <Link href="/user" className="perspective-card perspective-card-user">
          <span className="perspective-card-icon">
            <BookOpen size={24} aria-hidden="true" />
          </span>
          <span className="perspective-card-copy">
            <small>For travelers</small>
            <strong>User guide</strong>
            <span>Plan itineraries, manage reservations, track costs, use Today and travelogues, and work with the AI companion.</span>
          </span>
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
        <Link
          href="/developer"
          className="perspective-card perspective-card-developer"
        >
          <span className="perspective-card-icon">
            <Code2 size={24} aria-hidden="true" />
          </span>
          <span className="perspective-card-copy">
            <small>For contributors</small>
            <strong>Developer docs</strong>
            <span>Explore architecture, API contracts, frontend conventions, and deployment runbooks.</span>
          </span>
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
