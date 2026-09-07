import { HOME_USED_IN, HOME_USED_IN_HEADING, HOME_USED_IN_LEAD } from '../landing/copy';

export function HomeUsedIn() {
  return (
    <section className="used-in" aria-labelledby="used-in-heading">
      <h2 id="used-in-heading">{HOME_USED_IN_HEADING}</h2>
      <p className="used-in-lead">{HOME_USED_IN_LEAD}</p>
      <ul className="used-in-grid">
        {HOME_USED_IN.map((repo) => (
          <li key={repo.href}>
            <a href={repo.href} className="used-in-card">
              <span className="used-in-name">{repo.name}</span>
              <span className="used-in-what">{repo.what}</span>
              <span className="used-in-look">{repo.look}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="used-in-follow">
        <a href="/docs/used-in">How we keep them aligned</a>
      </p>
    </section>
  );
}
