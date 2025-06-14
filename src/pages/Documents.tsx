import React from 'react';

const Documents: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Documents
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage documents for RAG AI responses and Google Drive integration
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button type="button" className="btn-primary">
            Upload Document
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No documents uploaded</h3>
          <p className="mt-1 text-sm text-gray-500">
            Upload documents to improve AI responses and enable knowledge-based conversations.
          </p>
          <div className="mt-6">
            <button type="button" className="btn-primary">
              Upload Your First Document
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documents; 