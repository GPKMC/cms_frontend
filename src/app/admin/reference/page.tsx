"use client";

import React, { useState } from "react";
import { Upload, BookOpen, FileText, Plus, Check, AlertCircle } from "lucide-react";

export default function ReferenceUploader() {
  const [formData, setFormData] = useState({
    type: "",
    title: "",
    source_url: "",
    author: "",
    publisher: "",
    year: "",
    isbn: "",
    journal: "",
    volume: "",
    issue: "",
    pages: "",
    text: "",
    embedding: ""
  });

  const [csvFile, setCsvFile] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // success, error
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("single");

  // Use your real admin token here, e.g. from localStorage or context
  const token_admin = localStorage.getItem("token_admin") || "";

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCsvChange = (e) => {
    setCsvFile(e.target.files[0]);
  };

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  // Submit single reference as JSON
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    // Parse embedding if given
    let embeddingArray = [];
    if(formData.embedding.trim()) {
      try {
        embeddingArray = JSON.parse(formData.embedding);
      } catch {
        showMessage("Invalid JSON in embedding field", "error");
        setIsLoading(false);
        return;
      }
    }

    const payload = {
      ...formData,
      year: formData.year ? parseInt(formData.year, 10) : undefined,
      embedding: embeddingArray.length > 0 ? embeddingArray : undefined
    };

    try {
      const res = await fetch("/references/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token_admin,
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        showMessage("Reference added successfully!", "success");
        setFormData({
          type: "",
          title: "",
          source_url: "",
          author: "",
          publisher: "",
          year: "",
          isbn: "",
          journal: "",
          volume: "",
          issue: "",
          pages: "",
          text: "",
          embedding: ""
        });
      } else {
        showMessage(data.error || "Error adding reference", "error");
      }
    } catch (err) {
      showMessage("Network error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit CSV file for bulk upload
  const handleCsvSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    if (!csvFile) {
      showMessage("Please select a CSV file", "error");
      setIsLoading(false);
      return;
    }

    const formDataObj = new FormData();
    formDataObj.append("file", csvFile);

    try {
      const res = await fetch("http://localhost:5000/reference/upload", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token_admin,
        },
        body: formDataObj
      });

      const data = await res.json();
      if (res.ok) {
        showMessage(`Bulk upload successful: ${csvFile.name} processed`, "success");
        setCsvFile(null);
      } else {
        showMessage(data.error || "Error uploading CSV", "error");
      }
    } catch (err) {
      showMessage("Network error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const referenceTypes = [
    { value: "website", label: "Website" },
    { value: "book", label: "Book" },
    { value: "article", label: "Article" },
    { value: "journal", label: "Journal" },
    { value: "other", label: "Other" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Reference Manager</h1>
          <p className="text-gray-600 text-lg">Add and manage your research references with ease</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white p-1 rounded-xl shadow-lg border border-gray-100">
            <button
              onClick={() => setActiveTab("single")}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === "single"
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Plus className="w-4 h-4" />
              Single Reference
            </button>
            <button
              onClick={() => setActiveTab("bulk")}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === "bulk"
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Upload className="w-4 h-4" />
              Bulk Upload
            </button>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 transition-all duration-300 ${
            messageType === "success" 
              ? "bg-green-50 border-green-200 text-green-800" 
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            {messageType === "success" ? (
              <Check className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="font-medium">{message}</span>
          </div>
        )}

        {/* Single Reference Form */}
        {activeTab === "single" && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="w-6 h-6 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-900">Add Single Reference</h2>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reference Type *
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white"
                  >
                    <option value="">Select type...</option>
                    {referenceTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Year
                  </label>
                  <input
                    name="year"
                    type="number"
                    value={formData.year}
                    onChange={handleInputChange}
                    placeholder="e.g., 2024"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter the reference title"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Author */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Author
                  </label>
                  <input
                    name="author"
                    value={formData.author}
                    onChange={handleInputChange}
                    placeholder="Author name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                {/* Publisher */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Publisher
                  </label>
                  <input
                    name="publisher"
                    value={formData.publisher}
                    onChange={handleInputChange}
                    placeholder="Publisher name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              {/* Source URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Source URL
                </label>
                <input
                  name="source_url"
                  type="url"
                  value={formData.source_url}
                  onChange={handleInputChange}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* ISBN */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ISBN
                  </label>
                  <input
                    name="isbn"
                    value={formData.isbn}
                    onChange={handleInputChange}
                    placeholder="978-0-123456-78-9"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                {/* Journal */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Journal
                  </label>
                  <input
                    name="journal"
                    value={formData.journal}
                    onChange={handleInputChange}
                    placeholder="Journal name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                {/* Volume */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Volume
                  </label>
                  <input
                    name="volume"
                    value={formData.volume}
                    onChange={handleInputChange}
                    placeholder="Vol. 1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                {/* Issue */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Issue
                  </label>
                  <input
                    name="issue"
                    value={formData.issue}
                    onChange={handleInputChange}
                    placeholder="Issue 1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              {/* Pages */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pages
                </label>
                <input
                  name="pages"
                  value={formData.pages}
                  onChange={handleInputChange}
                  placeholder="e.g., 123-145"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              {/* Text
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Text Content *
                </label>
                <textarea
                  name="text"
                  value={formData.text}
                  onChange={handleInputChange}
                  required
                  rows={5}
                  placeholder="Enter the main text or content of the reference..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 resize-vertical"
                />
              </div> */}

              {/* Embedding */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Embedding (JSON Array, optional)
                </label>
                <textarea
                  name="embedding"
                  value={formData.embedding}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder='[0.1, 0.2, 0.3, ...]'
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 font-mono text-sm resize-vertical"
                />
              </div>

              <button
                type="button"
                onClick={handleSingleSubmit}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-indigo-600 hover:to-purple-700 focus:ring-4 focus:ring-indigo-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                {isLoading ? "Adding Reference..." : "Add Reference"}
              </button>
            </div>
          </div>
        )}

        {/* Bulk Upload Form */}
        {activeTab === "bulk" && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <Upload className="w-6 h-6 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-900">Bulk Upload References</h2>
            </div>
            
            <form onSubmit={handleCsvSubmit} className="space-y-6">
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-300 transition-colors duration-200">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <div className="space-y-2">
                  <label className="cursor-pointer">
                    <span className="text-lg font-medium text-gray-700">
                      {csvFile ? csvFile.name : "Choose CSV File"}
                    </span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-sm text-gray-500">
                    Upload a CSV file containing multiple references
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-3">CSV Format Requirements:</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• Include headers: type, title, author, publisher, year, text</p>
                  <p>• Optional fields: source_url, isbn, journal, volume, issue, pages</p>
                  <p>• Use UTF-8 encoding for special characters</p>
                  <p>• Maximum file size: 10MB</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !csvFile}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-indigo-600 hover:to-purple-700 focus:ring-4 focus:ring-indigo-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                {isLoading ? "Uploading..." : "Upload CSV"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
