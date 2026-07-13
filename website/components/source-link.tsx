import { GitHubIcon } from './icons'

const REPO_BLOB = 'https://github.com/stevysmith/agentk/blob/main/'

export function SourceLink({ file }: { file: string }) {
  return (
    <a
      className="source-link"
      href={`${REPO_BLOB}${file}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View this demo's source on GitHub`}
    >
      <GitHubIcon />
      <span>View source</span>
    </a>
  )
}
