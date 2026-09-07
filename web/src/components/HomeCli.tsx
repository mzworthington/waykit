import kitMd from '../../../docs/kit.md?raw';
import { HOME_CLI_HEADING } from '../landing/copy';
import { parseKitCommandsMarkdown } from '../landing/kitCommands';
import { presentInlineMarkdown } from '../landing/presentInlineMarkdown';

const { lead, rows } = parseKitCommandsMarkdown(kitMd);

export function HomeCli() {
  if (rows.length === 0) return null;

  return (
    <section id="cli" className="home-cli" aria-labelledby="cli-heading">
      <h2 id="cli-heading">{HOME_CLI_HEADING}</h2>
      {lead ? <p className="home-cli-lead">{presentInlineMarkdown(lead)}</p> : null}
      <div className="table-wrapper">
        <table>
          <caption>Commands from the operator guide</caption>
          <thead>
            <tr>
              <th scope="col">Command</th>
              <th scope="col">What it measures or installs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.command}>
                <th scope="row">
                  <code>{row.command}</code>
                </th>
                <td>{presentInlineMarkdown(row.purpose)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="home-cli-follow">
        <a href="/docs/kit">Operator guide: context, MCP, check, doctor</a>
      </p>
    </section>
  );
}
