export function findQaValidationDeployment(deployments, expectedSha, expectedEnvironment) {
  return deployments.find((deployment) => (
    deployment.sha === expectedSha
    && deployment.environment === expectedEnvironment
    && deployment.creator?.login === "vercel[bot]"
    && deployment.production_environment === false
  ))
}

export function findPostLaneVercelSuccess(statuses, laneMovedAt) {
  return statuses.find((status) => (
    status.state === "success"
    && status.creator?.login === "vercel[bot]"
    && Date.parse(status.created_at) >= laneMovedAt
  ))
}
