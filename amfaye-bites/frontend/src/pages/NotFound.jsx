import EmptyState from "../components/EmptyState";
export default function NotFound() {
  return (
    <div className="page container">
      <EmptyState
        title="This little bite went missing."
        text="We couldn't find that page. Let's get you back to something good."
        to="/"
        label="Back home"
      />
    </div>
  );
}
