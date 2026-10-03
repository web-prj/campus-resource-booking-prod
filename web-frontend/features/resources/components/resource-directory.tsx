import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { PaginationNav } from "@/components/pagination-nav";
import {
  ArrowRightIcon,
  MapPinIcon,
  PeopleIcon,
  RoomIcon,
  SearchIcon,
  ShieldCheckIcon,
  SlidersIcon,
} from "@/components/icons";
import { discoveryHref } from "../discovery-query";
import type {
  Building,
  Resource,
  ResourceDiscoveryFilters,
  ResourcePage,
  ResourceType,
} from "../types";
import { AvailabilityFilterFields } from "./availability-filter-fields";
import styles from "./resource-directory.module.css";

const typeLabels: Record<ResourceType, string> = {
  room: "Room",
};

function activeFilterCount(filters: ResourceDiscoveryFilters): number {
  return [
    filters.q,
    filters.buildingId,
    filters.minCapacity,
    filters.amenity,
    filters.date,
  ].filter((value) => value !== undefined).length;
}

/** Applied filters that live inside the collapsible panel (search stays visible). */
function panelFilterCount(filters: ResourceDiscoveryFilters): number {
  return [
    filters.buildingId,
    filters.minCapacity,
    filters.amenity,
    filters.date,
  ].filter((value) => value !== undefined).length;
}

interface ResourceDirectoryProps {
  page: ResourcePage;
  buildings: Building[];
  filters: ResourceDiscoveryFilters;
}

export function ResourceDirectory({
  page,
  buildings,
  filters,
}: ResourceDirectoryProps) {
  const appliedFilters = activeFilterCount(filters);
  const panelFilters = panelFilterCount(filters);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandMark />
        <nav className={styles.headerNav} aria-label="Resource navigation">
          <Link href="/" aria-current="page">
            Rooms
          </Link>
          <Link href="/bookings">My bookings</Link>
        </nav>
      </header>

      <div className={styles.shell}>
        <section className={styles.intro} aria-labelledby="directory-title">
          <div>
            <p className={styles.context}>Campus room directory</p>
            <h1 id="directory-title">Find the right room on campus.</h1>
            <p>
              Compare building, capacity, and amenities before checking
              operational hours.
            </p>
          </div>
          <div className={styles.directoryMark} aria-hidden="true">
            <span className={styles.directoryMarkBuilding}>USTH</span>
            <span className={styles.directoryMarkRoom}>A101</span>
            <i />
          </div>
        </section>

        <form
          key={JSON.stringify(filters)}
          className={styles.filters}
          action="/resources"
          method="get"
        >
          <div className={styles.filterHeading}>
            <span>
              <SlidersIcon />
            </span>
            <div>
              <h2>Search campus resources</h2>
              <p>
                Use one or several filters. All results are active resources.
              </p>
            </div>
            {appliedFilters > 0 && (
              <Link className={styles.clearFilters} href="/resources">
                Clear {appliedFilters}{" "}
                {appliedFilters === 1 ? "filter" : "filters"}
              </Link>
            )}
          </div>

          <div className={styles.searchRow}>
            <label className={styles.searchField}>
              <span>Room or location</span>
              <span className={styles.inputWithIcon}>
                <SearchIcon />
                <input
                  name="q"
                  type="search"
                  defaultValue={filters.q ?? ""}
                  maxLength={120}
                  placeholder="Room A101, first floor…"
                />
              </span>
            </label>
            <details className={styles.filterDisclosure}>
              <summary className={styles.filterToggle}>
                <SlidersIcon />
                Filters
                {panelFilters > 0 && (
                  <span className={styles.filterCount}>{panelFilters}</span>
                )}
              </summary>

              <div className={styles.filterGrid}>
            <label>
              <span>Building</span>
              <select name="buildingId" defaultValue={filters.buildingId ?? ""}>
                <option value="">All buildings</option>
                {buildings.map((building) => (
                  <option value={building.id} key={building.id}>
                    {building.code} — {building.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Minimum capacity</span>
              <input
                name="minCapacity"
                type="number"
                min="1"
                max="10000"
                defaultValue={filters.minCapacity}
                placeholder="Any capacity"
              />
            </label>

            <label>
              <span>Amenity</span>
              <input
                name="amenity"
                defaultValue={filters.amenity ?? ""}
                maxLength={50}
                placeholder="whiteboard, display…"
              />
            </label>

            <AvailabilityFilterFields
              key={`${filters.date ?? ""}:${filters.startTime ?? ""}:${filters.endTime ?? ""}`}
              filters={filters}
            />

            <label>
              <span>Sort results</span>
              <select name="sort" defaultValue={filters.sort ?? "name_asc"}>
                <option value="name_asc">Name A–Z</option>
                <option value="capacity_asc">Capacity: low to high</option>
                <option value="capacity_desc">Capacity: high to low</option>
              </select>
            </label>

                <button className={styles.applyFilters} type="submit">
                  <SearchIcon />
                  Apply filters
                </button>
              </div>
            </details>
            <button className={styles.srOnly} type="submit">
              Search resources
            </button>
          </div>
        </form>

        <section className={styles.results} aria-labelledby="results-title">
          <div className={styles.resultsHeading}>
            <div>
              <p className={styles.context}>Directory results</p>
              <h2 id="results-title">
                {page.total === 0
                  ? "No matching resources"
                  : `${page.total} ${page.total === 1 ? "resource" : "resources"}`}
              </h2>
            </div>
            {page.total > 0 && (
              <p>
                Page {page.page} of {page.totalPages}
              </p>
            )}
          </div>

          {page.items.length === 0 ? (
            <div className={styles.emptyState}>
              <span>
                <SearchIcon />
              </span>
              <div>
                <h3>No active resources match these filters</h3>
                <p>
                  {filters.date
                    ? filters.startTime
                      ? "Try a different date, a shorter interval, or fewer filters."
                      : "Try a different date, select a shorter interval, or remove another filter."
                    : "Try a broader capacity, another building, or remove the amenity filter."}
                </p>
              </div>
              <Link href="/resources">View all resources</Link>
            </div>
          ) : (
            <div className={styles.resourceGrid}>
              {page.items.map((resource) => (
                <ResourceCard
                  resource={resource}
                  filters={filters}
                  key={resource.id}
                />
              ))}
            </div>
          )}

          <PaginationNav
            className={styles.pagination}
            label="Resource pages"
            page={page.page}
            totalPages={page.totalPages}
            hrefFor={(number) => discoveryHref(filters, { page: number })}
            showPageLinks
            showPosition={false}
          />
        </section>
      </div>
    </main>
  );
}

function ResourceCard({
  resource,
  filters,
}: {
  resource: Resource;
  filters: ResourceDiscoveryFilters;
}) {
  const shownAmenities = resource.amenities.slice(0, 3);
  const remainingAmenities = resource.amenities.length - shownAmenities.length;
  const detailParams = new URLSearchParams();
  if (filters.date) detailParams.set("date", filters.date);
  if (filters.startTime) detailParams.set("startTime", filters.startTime);
  if (filters.endTime) detailParams.set("endTime", filters.endTime);
  const detailQuery = detailParams.toString();
  const detailHref = `/resources/${resource.id}${detailQuery ? `?${detailQuery}` : ""}`;

  return (
    <article className={styles.resourceCard}>
      <div className={styles.cardTopline}>
        <span className={styles.resourceIcon} data-type={resource.type}>
          <RoomIcon />
        </span>
        <span className={styles.typeLabel}>{typeLabels[resource.type]}</span>
        <span className={styles.activeStatus}>Active</span>
      </div>

      <div className={styles.cardIdentity}>
        <p>{resource.code}</p>
        <h3>
          <Link href={detailHref}>{resource.name}</Link>
        </h3>
        <span>
          <MapPinIcon /> {resource.building.code} · {resource.location}
        </span>
      </div>

      <div className={styles.cardFacts}>
        <span>
          <PeopleIcon />
          <strong>{resource.capacity}</strong>
          {resource.capacity === 1 ? "place" : "places"}
        </span>
        <span data-approval={resource.requiresApproval}>
          <ShieldCheckIcon />
          {resource.requiresApproval
            ? "Staff approval"
            : "No staff approval required"}
        </span>
      </div>

      <div className={styles.amenities} aria-label="Amenities">
        {shownAmenities.length ? (
          shownAmenities.map((amenity) => <span key={amenity}>{amenity}</span>)
        ) : (
          <span>Standard setup</span>
        )}
        {remainingAmenities > 0 && <span>+{remainingAmenities} more</span>}
      </div>

      <Link className={styles.detailsLink} href={detailHref}>
        View resource details <ArrowRightIcon />
      </Link>
    </article>
  );
}
