import React, { useEffect, useState } from 'react'
import { useDocumentStore } from '../store/documentStore'
import { 
  DocumentTextIcon, 
  CloudArrowUpIcon, 
  TrashIcon,
  EyeIcon,
  GlobeAltIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  LinkIcon
} from '@heroicons/react/24/outline'
import { formatDistanceToNow } from 'date-fns'
import LoadingSpinner from '../components/LoadingSpinner'

const Documents: React.FC = () => {
  const {
    documents,
    webPages,
    documentsLoading,
    webPagesLoading,
    uploading,
    processing,
    error,
    fetchDocuments,
    fetchWebPages,
    uploadDocument,
    deleteDocument,
    addWebPage,
    deleteWebPage,
    clearError
  } = useDocumentStore()

  const [activeTab, setActiveTab] = useState<'documents' | 'webpages'>('documents')
  const [dragOver, setDragOver] = useState(false)
  const [showAddWebPage, setShowAddWebPage] = useState(false)
  const [webPageUrl, setWebPageUrl] = useState('')
  const [includeChildren, setIncludeChildren] = useState(false)
  const [maxDepth, setMaxDepth] = useState(1)

  useEffect(() => {
    fetchDocuments()
    fetchWebPages()
  }, [fetchDocuments, fetchWebPages])

  const handleFileUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (file.type.startsWith('text/') || 
          file.name.endsWith('.md') || 
          file.name.endsWith('.txt') ||
          file.name.endsWith('.json')) {
        await uploadDocument(file)
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleAddWebPage = async () => {
    if (webPageUrl.trim()) {
      await addWebPage(webPageUrl.trim(), includeChildren, maxDepth)
      setShowAddWebPage(false)
      setWebPageUrl('')
      setIncludeChildren(false)
      setMaxDepth(1)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'processing':
      case 'scraping':
        return <ClockIcon className="h-5 w-5 text-yellow-500 animate-pulse" />
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Ready'
      case 'processing':
        return 'Processing...'
      case 'scraping':
        return 'Scraping...'
      case 'error':
        return 'Error'
      default:
        return 'Pending'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Knowledge Base
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage documents and web pages for RAG-powered AI responses
          </p>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
          <button
            onClick={() => setShowAddWebPage(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <GlobeAltIcon className="h-4 w-4 mr-2" />
            Add Web Page
          </button>
          <label className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
            <CloudArrowUpIcon className="h-4 w-4 mr-2" />
            Upload Documents
            <input
              type="file"
              multiple
              accept=".txt,.md,.json,text/*"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="ml-auto pl-3 text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'documents'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DocumentTextIcon className="h-5 w-5 inline mr-2" />
            Documents ({documents.length})
          </button>
          <button
            onClick={() => setActiveTab('webpages')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'webpages'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <GlobeAltIcon className="h-5 w-5 inline mr-2" />
            Web Pages ({webPages.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'documents' ? (
        <div className="space-y-4">
          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-center">
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {uploading ? 'Uploading...' : 'Upload documents'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Drag and drop files here, or click to select
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Supports: TXT, MD, JSON, and other text files
              </p>
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            )}
          </div>

          {/* Documents List */}
          {documentsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No documents uploaded</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload your first document to get started with AI responses.
              </p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <li key={doc.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <DocumentTextIcon className="h-8 w-8 text-blue-500" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {doc.title}
                          </h4>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            <span>{formatFileSize(doc.file_size || 0)}</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(doc.upload_date))} ago</span>
                            <span>•</span>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(doc.status)}
                              <span>{getStatusText(doc.status)}</span>
                            </div>
                          </div>
                          {doc.error_message && (
                            <p className="mt-1 text-sm text-red-600">{doc.error_message}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="p-2 text-gray-400 hover:text-gray-600">
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="p-2 text-gray-400 hover:text-red-600"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Web Pages List */}
          {webPagesLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : webPages.length === 0 ? (
            <div className="text-center py-12">
              <GlobeAltIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No web pages added</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add your first web page to include it in AI responses.
              </p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {webPages.map((page) => (
                  <li key={page.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <GlobeAltIcon className="h-8 w-8 text-green-500" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {page.title || page.url}
                          </h4>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            <a
                              href={page.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-blue-600 hover:text-blue-800"
                            >
                              <LinkIcon className="h-4 w-4 mr-1" />
                              {page.url}
                            </a>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(page.created_at))} ago</span>
                            <span>•</span>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(page.status)}
                              <span>{getStatusText(page.status)}</span>
                            </div>
                          </div>
                          {page.include_children && (
                            <p className="mt-1 text-xs text-blue-600">
                              Includes child pages (max depth: {page.max_depth})
                            </p>
                          )}
                          {page.error_message && (
                            <p className="mt-1 text-sm text-red-600">{page.error_message}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="p-2 text-gray-400 hover:text-gray-600">
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => deleteWebPage(page.id)}
                          className="p-2 text-gray-400 hover:text-red-600"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Add Web Page Modal */}
      {showAddWebPage && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Web Page</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={webPageUrl}
                    onChange={(e) => setWebPageUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="includeChildren"
                    checked={includeChildren}
                    onChange={(e) => setIncludeChildren(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="includeChildren" className="text-sm text-gray-700">
                    Include child pages
                  </label>
                </div>
                {includeChildren && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Depth
                    </label>
                    <select
                      value={maxDepth}
                      onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {[1, 2, 3, 4, 5].map(depth => (
                        <option key={depth} value={depth}>{depth}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddWebPage(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddWebPage}
                  disabled={!webPageUrl.trim() || processing}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Adding...' : 'Add Page'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Documents 