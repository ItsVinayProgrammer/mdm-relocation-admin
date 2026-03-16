import React, { useEffect, useMemo, useState } from "react";
import { db, firebaseConfigError } from "./firebaseConfig";
import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import AdminTopNav from "./AdminTopNav";
import { logAdminActivity } from "./activityLogger";

interface Submission {
  id: string;
  [key: string]: any;
}

interface BookingDataProps {
  onLogout: () => Promise<void>;
  isSuperAdmin: boolean;
}

const COLUMNS = [
  { key: "service-type", label: "Service Type" },
  { key: "from-location", label: "Pickup Location" },
  { key: "to-location", label: "Drop Location" },
  { key: "phone-number", label: "Phone Number" },
  { key: "moving-date", label: "Moving Date" },
  { key: "flexible-date", label: "Flexible" },
  { key: "submittedAt", label: "Submitted At" },
];

const fmtDate = (v: string) => (v ? new Date(v).toLocaleDateString() : "");
const fmtPhone = (v: string) => (v ? v.replace(/(\d{5})(\d{5})/, "$1-$2") : "");

const displayCell = (colKey: string, val: unknown): string => {
  if (colKey === "submittedAt") return fmtDate(String(val ?? ""));
  if (colKey === "flexible-date") return val === "on" ? "Yes" : "No";
  if (colKey === "phone-number") return fmtPhone(String(val ?? ""));
  return String(val ?? "");
};

const toExportObj = (row: Submission) => ({
  "Service Type": row["service-type"] || "",
  "Pickup Location": row["from-location"] || "",
  "Drop Location": row["to-location"] || "",
  "Phone Number": row["phone-number"] || "",
  "Moving Date": row["moving-date"] || "",
  "Flexible Date": row["flexible-date"] === "on" ? "Yes" : "No",
  "Submitted At": row["submittedAt"] ? new Date(row["submittedAt"]).toLocaleDateString() : "",
});

const toExportArr = (row: Submission) => [
  row["service-type"] || "",
  row["from-location"] || "",
  row["to-location"] || "",
  row["phone-number"] || "",
  row["moving-date"] || "",
  row["flexible-date"] === "on" ? "Yes" : "No",
  row["submittedAt"] ? new Date(row["submittedAt"]).toLocaleDateString() : "",
];

const SORT_OPTIONS = [
  { key: "submittedAt", label: "Submitted At" },
  { key: "moving-date", label: "Moving Date" },
  { key: "service-type", label: "Service Type" },
  { key: "from-location", label: "Pickup Location" },
  { key: "to-location", label: "Drop Location" },
];

const BookingData: React.FC<BookingDataProps> = ({ onLogout, isSuperAdmin }) => {
  const [data, setData] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(firebaseConfigError);
  const [sortKey, setSortKey] = useState<string | null>("submittedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchColumn, setSearchColumn] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [filterServiceTypes, setFilterServiceTypes] = useState<string[]>([]);
  const [filterFlexible, setFilterFlexible] = useState<"all" | "yes" | "no">("all");
  const [filterMovingDateFrom, setFilterMovingDateFrom] = useState("");
  const [filterMovingDateTo, setFilterMovingDateTo] = useState("");
  const [filterSubmittedFrom, setFilterSubmittedFrom] = useState("");
  const [filterSubmittedTo, setFilterSubmittedTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const submissionsQuery = query(collection(db, "submissions"), orderBy("submittedAt", "desc"));
        const snap = await getDocs(submissionsQuery);
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Submission[]);
      } catch (fetchError) {
        const errorText = fetchError instanceof Error ? fetchError.message : String(fetchError);
        const indexUrlMatch = errorText.match(/https:\/\/console\.firebase\.google\.com\S+/);
        if (indexUrlMatch?.[0]) {
          console.error("Firestore index required. Create it here:", indexUrlMatch[0]);
        }
        console.error("Failed to load booking data:", fetchError);
        setErrorMessage("Failed to load booking data from Firestore.");
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
    void logAdminActivity({ action: "Viewed Booking Analytics", target: "dashboard" });
  }, []);

  const filteredData = useMemo(() => {
    let result = [...data];

    // Text search
    if (searchTerm.trim()) {
      const lc = searchTerm.toLowerCase();
      result = result.filter((row) =>
        searchColumn === "all"
          ? Object.values(row).some((v) => String(v).toLowerCase().includes(lc))
          : String(row[searchColumn] ?? "").toLowerCase().includes(lc)
      );
    }

    // Service type chips
    if (filterServiceTypes.length > 0) {
      result = result.filter((row) => filterServiceTypes.includes(row["service-type"] || ""));
    }

    // Flexible date toggle
    if (filterFlexible !== "all") {
      result = result.filter((row) =>
        filterFlexible === "yes" ? row["flexible-date"] === "on" : row["flexible-date"] !== "on"
      );
    }

    // Moving date range (string yyyy-mm-dd comparison)
    if (filterMovingDateFrom) {
      result = result.filter((row) => (row["moving-date"] || "") >= filterMovingDateFrom);
    }
    if (filterMovingDateTo) {
      result = result.filter((row) => (row["moving-date"] || "") <= filterMovingDateTo);
    }

    // Submitted At range
    if (filterSubmittedFrom) {
      const from = new Date(filterSubmittedFrom).getTime();
      result = result.filter((row) => row["submittedAt"] && new Date(row["submittedAt"]).getTime() >= from);
    }
    if (filterSubmittedTo) {
      const to = new Date(filterSubmittedTo);
      to.setHours(23, 59, 59, 999);
      const toMs = to.getTime();
      result = result.filter((row) => row["submittedAt"] && new Date(row["submittedAt"]).getTime() <= toMs);
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        if (sortKey === "submittedAt") {
          const asMillis = (input: unknown) => {
            const candidate = input as { toMillis?: () => number; toDate?: () => Date };
            if (candidate?.toMillis) return candidate.toMillis();
            if (candidate?.toDate) return candidate.toDate().getTime();
            const parsed = new Date(String(input ?? "")).getTime();
            return Number.isFinite(parsed) ? parsed : 0;
          };
          const cmp = asMillis(a[sortKey]) - asMillis(b[sortKey]);
          return sortOrder === "asc" ? cmp : -cmp;
        }

        const cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
        return sortOrder === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [data, searchTerm, searchColumn, sortKey, sortOrder,
      filterServiceTypes, filterFlexible,
      filterMovingDateFrom, filterMovingDateTo,
      filterSubmittedFrom, filterSubmittedTo]);

  useEffect(() => { setCurrentPage(1); }, [
    searchTerm, searchColumn, filterServiceTypes, filterFlexible,
    filterMovingDateFrom, filterMovingDateTo, filterSubmittedFrom, filterSubmittedTo,
  ]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const exportRows = selectedIds.size > 0
    ? data.filter((r) => selectedIds.has(r.id))
    : filteredData;

  const doExcelExport = () => {
    if (exportRows.length === 0) { showToast("No data to export", "error"); return; }
    try {
      const ws = XLSX.utils.json_to_sheet(exportRows.map(toExportObj));
      ws["!cols"] = [
        { wch: 15 }, { wch: 20 }, { wch: 20 },
        { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 18 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Booking Data");
      XLSX.writeFile(wb, "BookingData.xlsx");
      void logAdminActivity({
        action: "Exported Excel",
        target: "submissions",
        metadata: { rows: exportRows.length, selectedOnly: selectedIds.size > 0 },
      });
      showToast("Excel exported successfully.");
    } catch {
      void logAdminActivity({
        action: "Exported Excel",
        target: "submissions",
        status: "error",
      });
      showToast("Excel export failed.", "error");
    }
  };

  const doPDFExport = () => {
    if (exportRows.length === 0) { showToast("No data to export", "error"); return; }
    try {
      const pdfDoc = new jsPDF();
      autoTable(pdfDoc, {
        head: [COLUMNS.map((c) => c.label)],
        body: exportRows.map(toExportArr),
        theme: "grid",
        margin: 10,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [255, 248, 239] },
      });
      pdfDoc.save("BookingData.pdf");
      void logAdminActivity({
        action: "Exported PDF",
        target: "submissions",
        metadata: { rows: exportRows.length, selectedOnly: selectedIds.size > 0 },
      });
      showToast("PDF exported successfully.");
    } catch {
      void logAdminActivity({
        action: "Exported PDF",
        target: "submissions",
        status: "error",
      });
      showToast("PDF export failed.", "error");
    }
  };

  const handleDeleteRow = async (id: string) => {
    if (!db) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "submissions", id));
      setData((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      void logAdminActivity({
        action: "Deleted booking submission",
        target: "submissions",
        metadata: { submissionId: id },
      });
      showToast("Record deleted successfully.");
    } catch {
      void logAdminActivity({
        action: "Deleted booking submission",
        target: "submissions",
        status: "error",
        metadata: { submissionId: id },
      });
      showToast("Failed to delete record.", "error");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!db || selectedIds.size === 0) {
      return;
    }

    if (!window.confirm(`Delete ${selectedIds.size} selected record(s)? This action cannot be undone.`)) {
      return;
    }

    setIsBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const failed: string[] = [];

    for (const id of ids) {
      try {
        await deleteDoc(doc(db, "submissions", id));
      } catch {
        failed.push(id);
      }
    }

    const deletedCount = ids.length - failed.length;
    if (deletedCount > 0) {
      setData((prev) => prev.filter((row) => !selectedIds.has(row.id)));
      setSelectedIds(new Set());
      void logAdminActivity({
        action: "Deleted booking submission",
        target: "submissions",
        metadata: { count: deletedCount, mode: "bulk" },
      });
      showToast(`${deletedCount} record(s) deleted successfully.`);
    }

    if (failed.length > 0) {
      void logAdminActivity({
        action: "Deleted booking submission",
        target: "submissions",
        status: "error",
        metadata: { failedCount: failed.length, mode: "bulk" },
      });
      showToast(`${failed.length} record(s) failed to delete.`, "error");
    }

    setIsBulkDeleting(false);
  };

  // Derived filter helpers
  const uniqueServiceTypes = useMemo(
    () => [...new Set(data.map((r) => String(r["service-type"] || "")))].filter(Boolean).sort(),
    [data]
  );

  const activeFilterCount =
    (searchTerm.trim() ? 1 : 0) +
    (filterServiceTypes.length > 0 ? 1 : 0) +
    (filterFlexible !== "all" ? 1 : 0) +
    ((filterMovingDateFrom || filterMovingDateTo) ? 1 : 0) +
    ((filterSubmittedFrom || filterSubmittedTo) ? 1 : 0);

  const resetAllFilters = () => {
    setSearchTerm("");
    setSearchColumn("all");
    setFilterServiceTypes([]);
    setFilterFlexible("all");
    setFilterMovingDateFrom("");
    setFilterMovingDateTo("");
    setFilterSubmittedFrom("");
    setFilterSubmittedTo("");
  };

  // Pagination & selection
  const formCounts = useMemo(
    () =>
      data.reduce((acc, curr) => {
        const k = curr.formId || "Unknown";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    [data]
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const allPageSelected =
    paginatedData.length > 0 && paginatedData.every((r) => selectedIds.has(r.id));

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) paginatedData.forEach((r) => next.delete(r.id));
      else paginatedData.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const pageNumbers: (number | "...")[] = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (currentPage > 3) pages.push("...");
    for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) pages.push(p);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }, [totalPages, currentPage]);

  const colCount = COLUMNS.length + (isSuperAdmin ? 2 : 1);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fff8ef]">
      <div className="pointer-events-none absolute -left-20 top-16 h-72 w-72 rounded-full bg-[#ffb0001f] blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-[#80000014] blur-3xl" />

      <div className="relative mx-auto max-w-[1400px] px-4 pb-8 pt-6 sm:px-8">
        <AdminTopNav onLogout={onLogout} isSuperAdmin={isSuperAdmin} />

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-[#fbbf24] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#ffd477] border-t-[#800000]" />
            <p className="mt-4 text-sm font-semibold text-[#800000]">Loading booking data...</p>
          </div>
        ) : (
          <>
            <section className="mb-5 rounded-2xl border border-[#f0d29d] bg-gradient-to-r from-[#ffffff] via-[#fffaf2] to-[#fff4e3] p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8c3b3b]">Operations Console</p>
                  <h1 className="mt-1 text-2xl font-black text-[#800000] sm:text-3xl">Booking Analytics Control Center</h1>
                  <p className="mt-1 text-sm text-[#6b1b1b]">Monitor shipments, isolate exceptions, and take action from one unified command surface.</p>
                </div>
                <div className="grid min-w-[240px] grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-[#ffd79e] bg-white px-3 py-2">
                    <p className="text-[#8c3b3b]">Active Filters</p>
                    <p className="text-lg font-extrabold text-[#800000]">{activeFilterCount}</p>
                  </div>
                  <div className="rounded-lg border border-[#ffd79e] bg-white px-3 py-2">
                    <p className="text-[#8c3b3b]">Rows Selected</p>
                    <p className="text-lg font-extrabold text-[#800000]">{selectedIds.size}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-[#f0d29d] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8c3b3b]">Total Bookings</p>
                <p className="mt-2 text-3xl font-black text-[#800000]">{data.length}</p>
              </div>
              <div className="rounded-2xl border border-[#f0d29d] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8c3b3b]">Visible Results</p>
                <p className="mt-2 text-3xl font-black text-[#800000]">{filteredData.length}</p>
              </div>
              <div className="rounded-2xl border border-[#f0d29d] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8c3b3b]">Filtered Out</p>
                <p className="mt-2 text-3xl font-black text-[#800000]">{Math.max(0, data.length - filteredData.length)}</p>
              </div>
              <div className="rounded-2xl border border-[#f0d29d] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8c3b3b]">Top Form</p>
                <p className="mt-2 truncate text-sm font-extrabold text-[#800000]">
                  {Object.entries(formCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-"}
                </p>
              </div>
            </section>

            <section className="mb-4 overflow-hidden rounded-2xl border border-[#eecf98] bg-white shadow-[0_10px_24px_-18px_rgba(0,0,0,0.45)]">
              <div className="border-b border-[#f4ddba] bg-[#fff8ef] px-4 py-3">
                <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#800000]">Search, Filters & Export</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="relative min-w-[220px] flex-1">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c4a882]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
                  </svg>
                  <input
                    type="text"
                    placeholder={
                      searchColumn !== "all"
                        ? `Search by ${COLUMNS.find((c) => c.key === searchColumn)?.label ?? ""}...`
                        : "Search all columns..."
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-lg border border-[#ffd79e] bg-[#fffdf9] py-2 pl-9 pr-8 text-sm text-[#4a1f1f] outline-none transition focus:border-[#800000] focus:ring-2 focus:ring-[#80000029]"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-lg font-bold leading-none text-[#800000]"
                    >
                      ×
                    </button>
                  )}
                </div>

                <select
                  value={searchColumn}
                  onChange={(e) => setSearchColumn(e.target.value)}
                  className="rounded-lg border border-[#ffd79e] bg-[#fff8ef] px-3 py-2 text-sm text-[#4a1f1f] outline-none focus:border-[#800000]"
                >
                  <option value="all">All Columns</option>
                  {COLUMNS.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className={`relative min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    showAdvanced || activeFilterCount > 0
                      ? "border-[#800000] bg-[#800000] text-white"
                      : "border-[#ffd79e] bg-[#fff8ef] text-[#4a1f1f] hover:border-[#800000]"
                  }`}
                >
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ffb000] text-[10px] font-bold text-[#4a1f1f]">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                <select
                  value={sortKey ?? "submittedAt"}
                  onChange={(e) => setSortKey(e.target.value)}
                  className="min-h-11 rounded-lg border border-[#ffd79e] bg-[#fff8ef] px-3 py-2 text-sm text-[#4a1f1f] outline-none focus:border-[#800000]"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setSortOrder((value) => (value === "asc" ? "desc" : "asc"))}
                  className="min-h-11 rounded-lg border border-[#ffd79e] bg-[#fff8ef] px-3 py-2 text-sm font-semibold text-[#4a1f1f] transition hover:border-[#800000]"
                >
                  Sort: {sortKey === "submittedAt" ? (sortOrder === "desc" ? "Newest First" : "Oldest First") : (sortOrder === "asc" ? "Ascending" : "Descending")}
                </button>

                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="min-h-11 rounded-lg border border-[#ffd79e] bg-[#fff8ef] px-3 py-2 text-sm text-[#4a1f1f] outline-none focus:border-[#800000]"
                >
                  {[10, 20, 30, 50].map((n) => (
                    <option key={n} value={n}>{n} rows</option>
                  ))}
                </select>

                <div className="ml-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={doExcelExport}
                    className="min-h-11 rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#14532d]"
                  >
                    ↓ Excel{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={doPDFExport}
                    className="min-h-11 rounded-lg bg-[#ffb000] px-4 py-2 text-sm font-semibold text-[#4a1f1f] transition hover:bg-[#d97706] hover:text-white"
                  >
                    ↓ PDF{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                  </button>
                </div>
              </div>

              {showAdvanced && (
                <div className="border-t border-[#f4ddba] bg-[#fffdf9] px-4 py-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#800000]">Service Type</p>
                      {uniqueServiceTypes.length === 0 ? (
                        <p className="text-xs text-[#c4a882]">No data yet</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {uniqueServiceTypes.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() =>
                                setFilterServiceTypes((prev) =>
                                  prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                                )
                              }
                              className={`min-h-11 rounded-full px-3 py-1 text-xs font-semibold transition ${
                                filterServiceTypes.includes(t)
                                  ? "bg-[#800000] text-white"
                                  : "border border-[#ffd79e] bg-[#fff8ef] text-[#4a1f1f] hover:border-[#800000]"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#800000]">Flexible Date</p>
                      <div className="flex overflow-hidden rounded-lg border border-[#ffd79e]">
                        {(["all", "yes", "no"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFilterFlexible(v)}
                            className={`min-h-11 flex-1 py-1.5 text-xs font-semibold transition ${
                              filterFlexible === v
                                ? "bg-[#800000] text-white"
                                : "bg-[#fff8ef] text-[#4a1f1f] hover:bg-[#fff1d8]"
                            }`}
                          >
                            {v === "all" ? "All" : v === "yes" ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#800000]">Moving Date</p>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={filterMovingDateFrom}
                          onChange={(e) => setFilterMovingDateFrom(e.target.value)}
                          className="min-h-11 w-full rounded-lg border border-[#ffd79e] bg-[#fff8ef] px-2 py-1.5 text-xs text-[#4a1f1f] outline-none focus:border-[#800000]"
                        />
                        <input
                          type="date"
                          value={filterMovingDateTo}
                          onChange={(e) => setFilterMovingDateTo(e.target.value)}
                          className="min-h-11 w-full rounded-lg border border-[#ffd79e] bg-[#fff8ef] px-2 py-1.5 text-xs text-[#4a1f1f] outline-none focus:border-[#800000]"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#800000]">Submitted At</p>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={filterSubmittedFrom}
                          onChange={(e) => setFilterSubmittedFrom(e.target.value)}
                          className="min-h-11 w-full rounded-lg border border-[#ffd79e] bg-[#fff8ef] px-2 py-1.5 text-xs text-[#4a1f1f] outline-none focus:border-[#800000]"
                        />
                        <input
                          type="date"
                          value={filterSubmittedTo}
                          onChange={(e) => setFilterSubmittedTo(e.target.value)}
                          className="min-h-11 w-full rounded-lg border border-[#ffd79e] bg-[#fff8ef] px-2 py-1.5 text-xs text-[#4a1f1f] outline-none focus:border-[#800000]"
                        />
                      </div>
                    </div>
                  </div>

                  {activeFilterCount > 0 && (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="min-h-11 px-2 text-xs font-semibold text-[#800000] underline hover:text-[#660000]"
                      >
                        Reset all filters
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(activeFilterCount > 0 || selectedIds.size > 0) && (
                <div className="border-t border-[#f4ddba] px-4 py-2">
                  {activeFilterCount > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {searchTerm.trim() && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1d8] px-2.5 py-1 text-xs font-semibold text-[#4a1f1f]">
                          Search: {searchTerm}
                          <button type="button" onClick={() => setSearchTerm("")} className="ml-0.5 font-bold text-[#800000]">×</button>
                        </span>
                      )}
                      {filterServiceTypes.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[#fff1d8] px-2.5 py-1 text-xs font-semibold text-[#4a1f1f]">
                          Type: {t}
                          <button type="button" onClick={() => setFilterServiceTypes((p) => p.filter((x) => x !== t))} className="ml-0.5 font-bold text-[#800000]">×</button>
                        </span>
                      ))}
                      {filterFlexible !== "all" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1d8] px-2.5 py-1 text-xs font-semibold text-[#4a1f1f]">
                          Flexible: {filterFlexible === "yes" ? "Yes" : "No"}
                          <button type="button" onClick={() => setFilterFlexible("all")} className="ml-0.5 font-bold text-[#800000]">×</button>
                        </span>
                      )}
                      {(filterMovingDateFrom || filterMovingDateTo) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1d8] px-2.5 py-1 text-xs font-semibold text-[#4a1f1f]">
                          Moving: {filterMovingDateFrom || "any"} to {filterMovingDateTo || "any"}
                          <button type="button" onClick={() => { setFilterMovingDateFrom(""); setFilterMovingDateTo(""); }} className="ml-0.5 font-bold text-[#800000]">×</button>
                        </span>
                      )}
                      {(filterSubmittedFrom || filterSubmittedTo) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1d8] px-2.5 py-1 text-xs font-semibold text-[#4a1f1f]">
                          Submitted: {filterSubmittedFrom || "any"} to {filterSubmittedTo || "any"}
                          <button type="button" onClick={() => { setFilterSubmittedFrom(""); setFilterSubmittedTo(""); }} className="ml-0.5 font-bold text-[#800000]">×</button>
                        </span>
                      )}
                    </div>
                  )}

                  {selectedIds.size > 0 && (
                    <div className="flex items-center gap-3 rounded-lg bg-[#fff1d8] px-3 py-2 text-sm">
                      <span className="font-semibold text-[#800000]">
                        {selectedIds.size} row{selectedIds.size > 1 ? "s" : ""} selected - exports will use selection only
                      </span>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => void handleBulkDelete()}
                          disabled={isBulkDeleting}
                          className="min-h-11 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                        >
                          {isBulkDeleting ? "Deleting..." : "Bulk Delete"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        className="ml-auto min-h-11 px-2 text-xs text-[#800000] underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#6b1b1b]">
                Showing {paginatedData.length > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} records
                {activeFilterCount > 0 && (
                  <span className="ml-1 font-semibold text-[#800000]">({Math.max(0, data.length - filteredData.length)} filtered from {data.length})</span>
                )}
              </p>
              <p className="text-xs font-semibold text-[#8c3b3b]">Real-time operational dataset</p>
            </section>

            <section className="mb-6 overflow-hidden rounded-2xl border border-[#eecf98] bg-white shadow-[0_18px_34px_-24px_rgba(0,0,0,0.55)]">
              <div className="grid gap-4 p-4 md:hidden">
                <div className="flex items-center justify-between rounded-xl border border-[#f4ddba] bg-[#fff8ef] px-3 py-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#6b1b1b]">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAllPage}
                      className="h-6 w-6 cursor-pointer accent-[#800000]"
                    />
                    Select all visible
                  </label>
                  {isSuperAdmin && selectedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleBulkDelete()}
                      disabled={isBulkDeleting}
                      className="min-h-11 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                    >
                      {isBulkDeleting ? "Deleting..." : "Bulk Delete"}
                    </button>
                  )}
                </div>

                {paginatedData.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#ffd79e] bg-[#fffaf2] px-4 py-10 text-center text-[#8c3b3b]">
                    No records found
                  </div>
                ) : (
                  paginatedData.map((row) => {
                    const isSelected = selectedIds.has(row.id);
                    return (
                      <article
                        key={row.id}
                        className={`overflow-hidden rounded-[24px] border transition-all ${
                          isSelected
                            ? "border-[#800000] bg-[#fff3df] shadow-[0_12px_24px_-18px_rgba(128,0,0,0.55)]"
                            : "border-[#f1d39f] bg-white shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)]"
                        }`}
                      >
                        <div className="border-b border-[#f4ddba] bg-gradient-to-r from-[#fff8ef] to-[#fff2dc] px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8c3b3b]">Booking Ticket</p>
                              <h3 className="mt-1 text-base font-extrabold text-[#800000]">{displayCell("service-type", row["service-type"]) || "Unknown Service"}</h3>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(row.id)}
                              className="mt-1 h-6 w-6 cursor-pointer accent-[#800000]"
                            />
                          </div>
                        </div>

                        <div className="space-y-4 px-4 py-4">
                          <div className="grid gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8c3b3b]">Pickup</p>
                              <p className="mt-1 text-sm font-semibold text-[#4a1f1f]">{displayCell("from-location", row["from-location"]) || "-"}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8c3b3b]">Drop</p>
                              <p className="mt-1 text-sm font-semibold text-[#4a1f1f]">{displayCell("to-location", row["to-location"]) || "-"}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#fffaf2] p-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8c3b3b]">Moving Date</p>
                              <p className="mt-1 text-sm text-[#4a1f1f]">{displayCell("moving-date", row["moving-date"]) || "-"}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8c3b3b]">Flexible</p>
                              <p className="mt-1 text-sm text-[#4a1f1f]">{displayCell("flexible-date", row["flexible-date"]) || "-"}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8c3b3b]">Contact</p>
                            <a
                              href={`tel:${String(row["phone-number"] || "").replace(/[^\d+]/g, "")}`}
                              className="mt-1 inline-flex min-h-11 items-center rounded-xl border border-[#ffd79e] bg-[#fff8ef] px-3 py-2 text-sm font-semibold text-[#800000] transition hover:border-[#800000] hover:bg-[#fff1d8]"
                            >
                              Call {displayCell("phone-number", row["phone-number"]) || "Customer"}
                            </a>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f4ddba] bg-[#fffdf9] px-4 py-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8c3b3b]">Submitted</p>
                            <p className="mt-1 text-sm text-[#4a1f1f]">{displayCell("submittedAt", row["submittedAt"]) || "-"}</p>
                          </div>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(row.id)}
                              className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              <div className="hidden max-h-[72vh] overflow-auto md:block">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#800000] text-white">
                      <th className="w-10 px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          onChange={toggleSelectAllPage}
                          className="h-5 w-5 cursor-pointer accent-[#ffb000]"
                          title="Select all on this page"
                        />
                      </th>
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="cursor-pointer select-none whitespace-nowrap border-r border-[#a63d3d] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-[#661010]"
                        >
                          {col.label}
                          {sortKey === col.key && (
                            <span className="ml-1 opacity-80">{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </th>
                      ))}
                      {isSuperAdmin && (
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em]">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={colCount} className="py-14 text-center text-[#8c3b3b]">No records found</td>
                      </tr>
                    ) : (
                      paginatedData.map((row, idx) => {
                        const isSelected = selectedIds.has(row.id);
                        return (
                          <tr
                            key={row.id}
                            className={`border-t border-[#ffe7c1] transition-colors ${
                              isSelected
                                ? "bg-[#fff1d8]"
                                : idx % 2 === 0
                                ? "bg-white hover:bg-[#fffbf0]"
                                : "bg-[#fff9f0] hover:bg-[#fffbf0]"
                            }`}
                          >
                            <td className="px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(row.id)}
                                className="h-5 w-5 cursor-pointer accent-[#800000]"
                              />
                            </td>
                            {COLUMNS.map((col) => {
                              const val = displayCell(col.key, row[col.key]);
                              return (
                                <td key={col.key} className="px-4 py-3 text-[#4a1f1f]">
                                  {val || <span className="text-[#c4a882]">-</span>}
                                </td>
                              );
                            })}
                            {isSuperAdmin && (
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(row.id)}
                                  className="min-h-11 rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                                >
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="min-h-11 rounded-lg border border-[#ffd79e] bg-white px-3 py-1.5 text-sm font-semibold text-[#800000] transition hover:bg-[#fff1d8] disabled:opacity-40"
                >
                  ← Prev
                </button>
                {pageNumbers.map((p, i) =>
                  p === "..." ? (
                    <span key={`el-${i}`} className="px-2 text-[#8c3b3b]">...</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p as number)}
                      className={`min-h-11 min-w-[44px] rounded-lg border px-2 py-1.5 text-sm font-semibold transition ${
                        currentPage === p
                          ? "border-[#800000] bg-[#800000] text-white"
                          : "border-[#ffd79e] bg-white text-[#800000] hover:bg-[#fff1d8]"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="min-h-11 rounded-lg border border-[#ffd79e] bg-white px-3 py-1.5 text-sm font-semibold text-[#800000] transition hover:bg-[#fff1d8] disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
            toast.type === "success"
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-red-600">Confirm Delete</p>
            <h3 className="mt-2 text-lg font-bold text-[#7c2d12]">Delete this submission?</h3>
            <p className="mt-2 text-sm text-[#7c2d12]">This action is permanent and cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="min-h-11 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDeleteRow(deleteConfirmId)}
                className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingData;
