import EmptyState from "../components/EmptyState";
export default function Unauthorized() {
  return (
    <div className="page container">
      <EmptyState
        title="This space is for staff."
        text="Your account doesn't have access to this page."
        to="/"
        label="Back to happy"
      />
    </div>
  );
}
