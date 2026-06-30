import { setFailed, setOutput } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';

type Octokit = InstanceType<typeof GitHub>;

const getPackageJson = async (ref: string, octokit: Octokit) => {
  const rawPath =  process.env['INPUT_PATH'] || 'package.json';
  const path = rawPath.replace(/^\.\//, ''); // Strips a leading ./ if it exists

  const packageJSON = (await octokit.rest.repos.getContent({
    ...context.repo,
    path,
    ref,
  }));

  const packageJSONData = packageJSON.data as { content: string };

  if (!packageJSONData) {
    throw new Error(`Could not find package.json for commit ${ref}`);
  }
  return JSON.parse(Buffer.from(packageJSONData.content, 'base64').toString());
};

const run = async () => {
  const token = process.env['GITHUB_TOKEN'];
  if (!token) {
    throw new Error('GITHUB_TOKEN not provided');
  }

  const octokit = getOctokit(token);
  const currentRef = context.sha;
  const previousRef = ((await octokit.rest.repos.getCommit({
    ...context.repo,
    ref: currentRef,
  })).data.parents[0] || {}).sha;

  const currentPackageJSON = await getPackageJson(currentRef, octokit);
  setOutput('current-package-version', currentPackageJSON.version);

  if (!previousRef) {
    setOutput('has-updated', true);
    return;
  }

  const previousPackageJSON = await getPackageJson(previousRef, octokit);
  setOutput('has-updated', currentPackageJSON.version !== previousPackageJSON.version);
};

run().catch(error => {
  setFailed(error.message);
});
