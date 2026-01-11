import { NextResponse } from 'next/server'
import { createSupabaseServer, isSuperadmin } from '@/lib/supabase-server'

export async function GET() {
  // Check authentication
  const isAdmin = await isSuperadmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const githubToken = process.env.GITHUB_TOKEN

  if (!githubToken) {
    return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 })
  }

  try {
    // Fetch ALL repos the authenticated user has access to
    // This includes: owned, private, org repos, and collaborator repos
    const response = await fetch(
      `https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const repos = await response.json()

    // Filter and map repos
    const filteredRepos = repos
      .filter((repo: any) => !repo.fork && !repo.archived)
      .map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        homepage: repo.homepage,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        updated_at: repo.updated_at,
        private: repo.private,
      }))

    return NextResponse.json({ repos: filteredRepos })
  } catch (error: any) {
    console.error('GitHub API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}