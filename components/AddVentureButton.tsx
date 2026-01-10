'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import { Plus, X, Github, Loader2, ExternalLink } from 'lucide-react'
import { slugify } from '@/lib/utils'

interface AddVentureButtonProps {
  variant?: 'primary' | 'ghost'
}

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  homepage: string | null
  language: string | null
  stargazers_count: number
  updated_at: string
}

export default function AddVentureButton({ variant = 'primary' }: AddVentureButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [targetArr, setTargetArr] = useState('1000000')

  // Fetch GitHub repos when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchGitHubRepos()
    }
  }, [isOpen])

  const fetchGitHubRepos = async () => {
    setLoadingRepos(true)
    setError(null)
    try {
      const response = await fetch('/api/github/repos')
      if (!response.ok) throw new Error('Failed to fetch repos')
      const data = await response.json()
      setRepos(data.repos || [])
    } catch (err) {
      setError('Failed to load GitHub repos. Check your GitHub token.')
    } finally {
      setLoadingRepos(false)
    }
  }

  const handleSelectRepo = (repo: GitHubRepo) => {
    setSelectedRepo(repo)
    setName(repo.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
    setTagline(repo.description || '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRepo) return

    setLoading(true)
    setError(null)

    try {
      const supabase = createSupabaseBrowser()
      
      const { error: insertError } = await supabase
        .from('ventures')
        .insert({
          name,
          slug: slugify(name),
          tagline,
          github_repo: selectedRepo.full_name,
          github_url: selectedRepo.html_url,
          url: selectedRepo.homepage,
          target_arr: parseFloat(targetArr),
          status: 'active',
        })

      if (insertError) throw insertError

      setIsOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to create venture')
    } finally {
      setLoading(false)
    }
  }

  const filteredRepos = repos.filter(repo =>
    repo.name.toLowerCase().includes(search.toLowerCase()) ||
    repo.description?.toLowerCase().includes(search.toLowerCase())
  )

  if (variant === 'ghost') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="flex flex-col items-center gap-2 text-gray-400 hover:text-gray-600 transition"
        >
          <Plus className="w-8 h-8" />
          <span className="text-sm font-medium">Add Venture</span>
        </button>
        {isOpen && <Modal />}
      </>
    )
  }

  function Modal() {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Add New Venture</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {!selectedRepo ? (
                <>
                  {/* Search */}
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search repositories..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Repo List */}
                  {loadingRepos ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredRepos.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => handleSelectRepo(repo)}
                          className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 transition text-left"
                        >
                          <Github className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{repo.name}</p>
                            {repo.description && (
                              <p className="text-sm text-gray-500 truncate">{repo.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              {repo.language && (
                                <span className="text-xs text-gray-400">{repo.language}</span>
                              )}
                              <span className="text-xs text-gray-400">★ {repo.stargazers_count}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                      {filteredRepos.length === 0 && !loadingRepos && (
                        <p className="text-center text-gray-500 py-8">No repositories found</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Selected Repo */}
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <Github className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{selectedRepo.full_name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRepo(null)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Change
                    </button>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venture Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Tagline */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tagline
                    </label>
                    <input
                      type="text"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Brief description of the venture"
                    />
                  </div>

                  {/* Target ARR */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target ARR
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        value={targetArr}
                        onChange={(e) => setTargetArr(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setSelectedRepo(null)}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Venture'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        <Plus className="w-4 h-4" />
        Add Venture
      </button>
      {isOpen && <Modal />}
    </>
  )
}
