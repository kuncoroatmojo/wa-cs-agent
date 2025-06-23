import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Document, WebPage } from '../types'
import { DocumentService } from '../services/documentService'
import { WebPageService } from '../services/webPageService'

interface DocumentState {
  // Documents
  documents: Document[]
  selectedDocument: Document | null
  documentsLoading: boolean
  
  // Web pages
  webPages: WebPage[]
  selectedWebPage: WebPage | null
  webPagesLoading: boolean
  
  // General
  error: string | null
  uploading: boolean
  processing: boolean
  
  // Document actions
  fetchDocuments: (folderPath?: string) => Promise<void>
  uploadDocument: (file: File, folderPath?: string) => Promise<void>
  deleteDocument: (documentId: string) => Promise<void>
  setSelectedDocument: (document: Document | null) => void
  
  // Web page actions
  fetchWebPages: () => Promise<void>
  addWebPage: (url: string, includeChildren?: boolean, maxDepth?: number) => Promise<void>
  deleteWebPage: (webPageId: string) => Promise<void>
  setSelectedWebPage: (webPage: WebPage | null) => void
  
  // General actions
  clearError: () => void
  pollDocumentStatus: (documentId: string) => Promise<void>
  pollWebPageStatus: (webPageId: string) => Promise<void>
}

const documentService = new DocumentService()
const webPageService = new WebPageService()

export const useDocumentStore = create<DocumentState>()(
  devtools(
    (set, get) => ({
      // Initial state
      documents: [],
      selectedDocument: null,
      documentsLoading: false,
      webPages: [],
      selectedWebPage: null,
      webPagesLoading: false,
      error: null,
      uploading: false,
      processing: false,

      // Fetch documents
      fetchDocuments: async (folderPath?: string) => {
        try {
          set({ documentsLoading: true, error: null })
          
          const documents = await documentService.getDocuments('current-user-id', folderPath)
          
          set({ documents, documentsLoading: false })
        } catch { // Ignored 
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch documents',
            documentsLoading: false
          })
        }
      },

      // Upload document
      uploadDocument: async (file: File, folderPath = '/') => {
        try {
          set({ uploading: true, error: null })
          
          const document = await documentService.uploadDocument('current-user-id', file, folderPath)
          
          // Add to documents list
          const { documents } = get()
          set({
            documents: [document, ...documents],
            uploading: false
          })
          
          // Start polling for processing status
          get().pollDocumentStatus(document.id)
          
        } catch { // Ignored 
          set({
            error: error instanceof Error ? error.message : 'Failed to upload document',
            uploading: false
          })
        }
      },

      // Delete document
      deleteDocument: async (documentId: string) => {
        try {
          await documentService.deleteDocument(documentId)
          
          const { documents } = get()
          set({
            documents: documents.filter(doc => doc.id !== documentId),
            selectedDocument: get().selectedDocument?.id === documentId ? null : get().selectedDocument
          })
        } catch { // Ignored 
          set({
            error: error instanceof Error ? error.message : 'Failed to delete document'
          })
        }
      },

      // Set selected document
      setSelectedDocument: (document: Document | null) => {
        set({ selectedDocument: document })
      },

      // Fetch web pages
      fetchWebPages: async () => {
        try {
          set({ webPagesLoading: true, error: null })
          
          const webPages = await webPageService.getWebPages('current-user-id')
          
          set({ webPages, webPagesLoading: false })
        } catch { // Ignored 
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch web pages',
            webPagesLoading: false
          })
        }
      },

      // Add web page
      addWebPage: async (url: string, includeChildren = false, maxDepth = 1) => {
        try {
          set({ processing: true, error: null })
          
          const webPage = await webPageService.addWebPage('current-user-id', url, includeChildren, maxDepth)
          
          // Add to web pages list
          const { webPages } = get()
          set({
            webPages: [webPage, ...webPages],
            processing: false
          })
          
          // Start polling for scraping status
          get().pollWebPageStatus(webPage.id)
          
        } catch { // Ignored 
          set({
            error: error instanceof Error ? error.message : 'Failed to add web page',
            processing: false
          })
        }
      },

      // Delete web page
      deleteWebPage: async (webPageId: string) => {
        try {
          await webPageService.deleteWebPage(webPageId)
          
          const { webPages } = get()
          set({
            webPages: webPages.filter(page => page.id !== webPageId),
            selectedWebPage: get().selectedWebPage?.id === webPageId ? null : get().selectedWebPage
          })
        } catch { // Ignored 
          set({
            error: error instanceof Error ? error.message : 'Failed to delete web page'
          })
        }
      },

      // Set selected web page
      setSelectedWebPage: (webPage: WebPage | null) => {
        set({ selectedWebPage: webPage })
      },

      // Clear error
      clearError: () => {
        set({ error: null })
      },

      // Poll document processing status
      pollDocumentStatus: async (documentId: string) => {
        const pollInterval = setInterval(async () => {
          try {
            const { documents } = get()
            const document = documents.find(doc => doc.id === documentId)
            
            if (!document || document.status === 'ready' || document.status === 'error') {
              clearInterval(pollInterval)
              return
            }
            
            // Fetch updated document status
            const updatedDocument = await documentService.getDocument(documentId)
            if (updatedDocument) {
              set({
                documents: documents.map(doc => doc.id === documentId ? updatedDocument : doc)
              })
              
              if (updatedDocument.status === 'ready' || updatedDocument.status === 'error') {
                clearInterval(pollInterval)
              }
            }
          } catch { // Ignored 
            console.error('Error polling document status:', error)
            clearInterval(pollInterval)
          }
        }, 2000) // Poll every 2 seconds
      },

      // Poll web page scraping status
      pollWebPageStatus: async (webPageId: string) => {
        const pollInterval = setInterval(async () => {
          try {
            const { webPages } = get()
            const webPage = webPages.find(page => page.id === webPageId)
            
            if (!webPage || webPage.status === 'ready' || webPage.status === 'error') {
              clearInterval(pollInterval)
              return
            }
            
            // Fetch updated web page status
            const updatedWebPage = await webPageService.getWebPage(webPageId)
            if (updatedWebPage) {
              set({
                webPages: webPages.map(page => page.id === webPageId ? updatedWebPage : page)
              })
              
              if (updatedWebPage.status === 'ready' || updatedWebPage.status === 'error') {
                clearInterval(pollInterval)
              }
            }
          } catch { // Ignored 
            console.error('Error polling web page status:', error)
            clearInterval(pollInterval)
          }
        }, 3000) // Poll every 3 seconds
      }
    }),
    { name: 'document-store' }
  )
) 