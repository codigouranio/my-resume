# Publishing Binaries to GitHub

## Overview

This project uses GitHub Actions to automatically build and publish release artifacts (binaries) whenever you create a version tag.

## Quick Start

### 1. Create a Release

```bash
# Tag your current commit with a version
git tag v1.0.0

# Push the tag to GitHub (triggers the workflow)
git push origin v1.0.0
```

The GitHub Action will automatically:
- ✅ Build the frontend (React + Rsbuild)
- ✅ Build the API service (NestJS + Prisma)
- ✅ Package the LLM service (Flask)
- ✅ Create a GitHub Release with downloadable `.tar.gz` files

### 2. Manual Release (via GitHub UI)

1. Go to **Actions** tab in your repository
2. Select **"Build and Release"** workflow
3. Click **"Run workflow"**
4. Enter version (e.g., `v1.0.0`)
5. Click **"Run workflow"**

## Release Artifacts

Each release includes three build artifacts:

### 📦 `frontend-dist.tar.gz`
- React application (built with Rsbuild)
- Static files ready for deployment
- Contents: `apps/my-resume/dist/`

### 📦 `api-service-dist.tar.gz`
- NestJS API backend
- Includes compiled code, dependencies, Prisma client
- Contents: `dist/`, `node_modules/`, `prisma/`, `package.json`

### 📦 `llm-service-dist.tar.gz`
- Flask LLM service
- Python source files and dependencies list
- Contents: `*.py`, `requirements.txt`, docs

## Installation from Release

Users can download and extract the artifacts:

```bash
# Download from GitHub Releases page or use wget/curl
wget https://github.com/codigouranio/my-resume/releases/download/v1.0.0/frontend-dist.tar.gz
wget https://github.com/codigouranio/my-resume/releases/download/v1.0.0/api-service-dist.tar.gz
wget https://github.com/codigouranio/my-resume/releases/download/v1.0.0/llm-service-dist.tar.gz

# Extract
tar -xzf frontend-dist.tar.gz
tar -xzf api-service-dist.tar.gz
tar -xzf llm-service-dist.tar.gz
```

## Versioning

This project uses **Semantic Versioning** (SemVer):

- `v1.0.0` - Major release (breaking changes)
- `v1.1.0` - Minor release (new features, backward compatible)
- `v1.0.1` - Patch release (bug fixes)

### Version Bump Examples

```bash
# Bug fix
git tag v1.0.1
git push origin v1.0.1

# New feature
git tag v1.1.0
git push origin v1.1.0

# Breaking change
git tag v2.0.0
git push origin v2.0.0
```

## Advanced: Pre-releases

Create pre-release versions for testing:

```bash
git tag v1.1.0-beta.1
git push origin v1.1.0-beta.1
```

## Docker Images (Future)

To enable Docker image publishing:

1. Add Dockerfiles to each service directory
2. Edit `.github/workflows/release.yml`
3. Change `if: false` to `if: true` in the `build-docker` job

Images will be published to GitHub Container Registry:
- `ghcr.io/codigouranio/my-resume/frontend:latest`
- `ghcr.io/codigouranio/my-resume/api-service:latest`
- `ghcr.io/codigouranio/my-resume/llm-service:latest`

## Troubleshooting

### Release Failed to Create

**Problem:** GitHub Action completes but no release appears

**Solution:** Check you have pushed the tag:
```bash
git push origin v1.0.0  # Don't forget to push tags!
```

### Build Artifacts Missing

**Problem:** Some `.tar.gz` files are missing from release

**Solution:** Check the GitHub Actions logs for build errors:
1. Go to **Actions** tab
2. Click on the failed workflow run
3. Review the logs for each job

### Permission Denied

**Problem:** `Error: Resource not accessible by integration`

**Solution:** Ensure GitHub Actions has write permissions:
1. Go to **Settings** → **Actions** → **General**
2. Under **Workflow permissions**, select **"Read and write permissions"**
3. Click **Save**

## Continuous Deployment Integration

You can use these artifacts in your Ansible deployment:

```bash
# Download latest release
LATEST_VERSION=$(curl -s https://api.github.com/repos/codigouranio/my-resume/releases/latest | jq -r .tag_name)

# Download artifacts
wget "https://github.com/codigouranio/my-resume/releases/download/${LATEST_VERSION}/api-service-dist.tar.gz"

# Extract on server
tar -xzf api-service-dist.tar.gz -C /opt/my-resume/apps/api-service/
```

## GitHub CLI (gh) Usage

Install GitHub CLI and create releases easily:

```bash
# Install gh (macOS)
brew install gh

# Authenticate
gh auth login

# Create release with artifacts
gh release create v1.0.0 \
  frontend-dist.tar.gz \
  api-service-dist.tar.gz \
  llm-service-dist.tar.gz \
  --title "Release v1.0.0" \
  --notes "Initial release"
```

## Automated Changelog

For automatic changelog generation, install:

```bash
npm install -g conventional-changelog-cli

# Generate changelog
conventional-changelog -p angular -i CHANGELOG.md -s
```

## Next Steps

1. ✅ **Created** `.github/workflows/release.yml` - Automated build workflow
2. 🔄 **Test** by creating your first tag: `git tag v1.0.0 && git push origin v1.0.0`
3. 📝 **Document** version changes in commit messages
4. 🐳 **Optional**: Add Dockerfiles for container-based distribution
5. 📊 **Monitor** releases at: https://github.com/codigouranio/my-resume/releases

## References

- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Semantic Versioning](https://semver.org/)
- [GitHub Actions: upload-artifact](https://github.com/actions/upload-artifact)
- [GitHub Actions: softprops/action-gh-release](https://github.com/softprops/action-gh-release)
