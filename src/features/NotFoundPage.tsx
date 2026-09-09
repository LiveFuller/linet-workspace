// NotFound: useful screen with links, no leaking of object existence.
import { Link } from "react-router-dom";
import { useApp } from "@/app/AppProvider";

export default function NotFoundPage() {
  const { t } = useApp();
  return (
    <div className="page page-narrow">
      <h1 className="page-title">{t.not_found_title}</h1>
      <p className="page-subtitle">{t.not_found_body}</p>
      <div className="row wrap">
        <Link className="btn btn-primary" to="/">{t.nav_today}</Link>
        <Link className="btn btn-secondary" to="/tasks">{t.nav_tasks}</Link>
      </div>
    </div>
  );
}
