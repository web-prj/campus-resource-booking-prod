import { RouteState } from "@/components/route-state";

export default function ResourcesLoading() {
  return (
    <RouteState
      busy
      eyebrow="Loading room data"
      title="Checking the campus directory"
      description="Fetching active campus rooms and current availability filters."
    />
  );
}
