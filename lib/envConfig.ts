import { loadEnvConfig } from "@next/env"

// Usage: import "./lib/envConfig.ts"
// Necessary when running scripts in this repo that need to read environment variables but aren't
// running as part of the NextJS runtime, which loads environment variables automatically.
// https://nextjs.org/docs/app/guides/environment-variables#loading-environment-variables-with-nextenv

const projectDir = process.cwd()
loadEnvConfig(projectDir)
