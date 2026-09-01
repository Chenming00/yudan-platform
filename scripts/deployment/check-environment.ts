import { validateDeploymentEnvironment, type DeploymentTarget } from "../../lib/config/deployment";

const target = process.argv.find((argument) => argument.startsWith("--target="))?.split("=")[1];
if (target !== "preview" && target !== "production") {
  console.error("Usage: npm run deployment:check -- --target=preview|production");
  process.exit(2);
}

const issues = validateDeploymentEnvironment(process.env, target as DeploymentTarget);
if (issues.length > 0) {
  console.error(`Deployment environment check failed for ${target}:`);
  for (const issue of issues) console.error(`- ${issue.key}: ${issue.message}`);
  process.exit(1);
}

console.log(`Deployment environment check passed for ${target}.`);
