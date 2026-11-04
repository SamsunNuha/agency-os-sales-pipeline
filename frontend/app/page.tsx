"use client";
import { useEffect, useState, useCallback, useRef, useReducer } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  api,
  formatCurrency,
  formatDate,
  timeAgo,
  type Deal,
  type Pipeline,
  type PipelineStage,
  type FollowUp,
  type JwtPayload,
} from "./lib";
import Logo from "./components/Logo";

/* =========================================================
   Toast System
   ========================================================= */
interface Toast {
  id: string;
  type: "success" | "error" | "info";
  msg: string;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((type: Toast["type"], msg: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((p) => [...p, { id, type, msg }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);
  const success = useCallback((m: string) => add("success", m), [add]);
  const error = useCallback((m: string) => add("error", m), [add]);
  const info = useCallback((m: string) => add("info", m), [add]);
  return { toasts, success, error, info };
}

/* =========================================================
   Helpers
   ========================================================= */
function probabilityLabel(p: number): { color: string; label: string } {
  if (p >= 70) return { color: "var(--green)", label: "High" };
  if (p >= 40) return { color: "var(--yellow)", label: "Medium" };
  return { color: "var(--red)", label: "Low" };
}

/* =========================================================
   Deal Card (Draggable)
   ========================================================= */
function DealCard({
  deal,
  onOpenDetail,
}: {
  deal: Deal;
  onOpenDetail: (d: Deal) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const prob = deal.intelligence?.calculatedProbability;
  const probInfo = prob !== undefined && prob !== null ? probabilityLabel(prob) : null;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="deal-card">
      <div className="deal-card-title truncate">{deal.title}</div>
      <div className="deal-card-client">
        {deal.client.name}
        {deal.client.company && deal.client.company !== deal.client.name
          ? ` - ${deal.client.company}`
          : ""}
      </div>
      <div className="deal-card-footer">
        <span className="deal-card-value" style={{ color: "var(--text-primary)" }}>
          {formatCurrency(deal.expectedValue, deal.currency)}
        </span>
        {probInfo && (
          <span className="deal-card-prob" style={{ color: "var(--text-primary)" }}>
            <span style={{ color: probInfo.color }}>{"\u25CF"}</span> {prob}% {probInfo.label}
          </span>
        )}
      </div>
      {deal.wonAt && (
        <div style={{ fontSize: 11, color: "var(--green)", marginTop: 4 }}>
          Won: {formatDate(deal.wonAt)}
        </div>
      )}
      {deal.intelligence?.isStalled && (
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: "var(--yellow)" }}>
          {"\u26A0"} Stalled
        </div>
      )}
      <div className="deal-card-actions">
        <button
          className="btn btn-secondary btn-xs"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(deal);
          }}
        >
          Details
        </button>
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
          {formatDate(deal.expectedCloseDate)}
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   Kanban Column
   ========================================================= */
function KanbanColumn({
  stage,
  deals,
  onOpenDetail,
}: {
  stage: PipelineStage;
  deals: Deal[];
  onOpenDetail: (d: Deal) => void;
}) {
  // Makes the whole column a drop target, so cards can be dropped into empty columns.
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stage.id}` });

  return (
    <div className="kanban-column">
      <div className="kanban-column-header">
        <div className="kanban-stage-dot" style={{ background: stage.color }} />
        <span className="kanban-stage-name">{stage.name}</span>
        {stage.isWon && <span style={{ fontSize: 11, color: "var(--green)" }}>Won</span>}
        {stage.isLost && <span style={{ fontSize: 11, color: "var(--red)" }}>Lost</span>}
        <span className="kanban-count">{deals.length}</span>
      </div>
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          className="kanban-cards"
          id={`col-${stage.id}`}
          ref={setNodeRef}
          style={isOver ? { background: "var(--accent-glow)" } : undefined}
        >
          {deals.length === 0 ? (
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: 12,
                textAlign: "center",
                padding: 16,
              }}
            >
              Drop deals here
            </div>
          ) : (
            deals.map((d) => <DealCard key={d.id} deal={d} onOpenDetail={onOpenDetail} />)
          )}
        </div>
      </SortableContext>
    </div>
  );
}

/* =========================================================
   Deal Detail Modal
   ========================================================= */
function DealDetailModal({
  deal,
  onClose,
  onRefresh,
  toast,
}: {
  deal: Deal;
  onClose: () => void;
  onRefresh: () => void;
  toast: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };
}) {
  const [fullDeal, setFullDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"history" | "followups" | "actions">("history");
  const [lostReason, setLostReason] = useState("");
  const [lostNote, setLostNote] = useState("");
  const [showLostForm, setShowLostForm] = useState(false);
  const [fuNote, setFuNote] = useState("");
  const [fuDate, setFuDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoffResult, setHandoffResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api
      .getDeal(deal.id)
      .then(setFullDeal)
      .catch(() => setFullDeal(deal))
      .finally(() => setLoading(false));
  }, [deal]);

  const d = fullDeal || deal;

  async function doMarkWon() {
    if (busy) return;
    setBusy(true);
    try {
      await api.markWon(d.id);
      toast.success(`"${d.title}" marked as Won!`);
      onRefresh();
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doMarkLost() {
    if (busy) return;
    if (!lostReason.trim()) return toast.error("Lost reason is required");
    setBusy(true);
    try {
      await api.markLost(d.id, lostReason, lostNote || undefined);
      toast.success("Deal marked as Lost");
      onRefresh();
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doHandoff() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api.initiateHandoff(d.id);
      setHandoffResult(result);
      toast.success("Project handoff initiated!");
      onRefresh();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doCreateFollowUp() {
    if (!fuNote.trim() || !fuDate) return toast.error("Note and date required");
    setBusy(true);
    try {
      await api.createFollowUp(d.id, new Date(fuDate).toISOString(), fuNote);
      toast.success("Follow-up scheduled!");
      setFuNote("");
      setFuDate("");
      const refreshed = await api.getDeal(d.id);
      setFullDeal(refreshed);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doCompleteFollowUp(fuId: string) {
    setBusy(true);
    try {
      await api.updateFollowUp(fuId, { completedAt: new Date().toISOString() });
      toast.success("Follow-up completed!");
      const refreshed = await api.getDeal(d.id);
      setFullDeal(refreshed);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stateColor: Record<string, string> = {
    ACTIVE: "badge-active",
    WON: "badge-won",
    LOST: "badge-lost",
    ARCHIVED: "badge-archived",
  };

  const prob = d.intelligence?.calculatedProbability;
  const probInfo = prob !== undefined && prob !== null ? probabilityLabel(prob) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`badge ${stateColor[d.state]}`}>{d.state}</span>
              {d.intelligence?.isStalled && (
                <span className="badge" style={{ background: "var(--yellow-bg)", color: "var(--yellow)" }}>
                  {"\u26A0"} Stalled
                </span>
              )}
            </div>
            <h2 className="modal-title" style={{ marginBottom: 0 }}>
              {d.title}
            </h2>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              {d.client.name} | {d.pipeline.name} | {d.stage.name}
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ marginLeft: 12 }}
            aria-label="Close"
          >
            X
          </button>
        </div>

        <div className="grid-3" style={{ gap: 10, marginBottom: 16 }}>
          <div className="card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>VALUE</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
              {formatCurrency(d.expectedValue, d.currency)}
            </div>
          </div>
          <div className="card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>PROBABILITY</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--accent)" }}>
              {prob ?? "-"}%{probInfo ? ` ${probInfo.label}` : ""}
            </div>
          </div>
          <div className="card" style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>CLOSE DATE</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {formatDate(d.expectedCloseDate)}
            </div>
          </div>
        </div>

        {d.lostReason && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            <span>Lost: {d.lostReason}</span>
            {d.lostNote && (
              <span style={{ fontSize: 12, marginTop: 2, display: "block" }}>{d.lostNote}</span>
            )}
          </div>
        )}
        {d.handedOffAt && (
          <div className="alert alert-success" style={{ marginBottom: 12 }}>
            Project handed off on {formatDate(d.handedOffAt)}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {(["history", "followups", "actions"] as const).map((t) => (
            <button
              key={t}
              className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTab(t)}
            >
              {t === "history" ? "Stage History" : t === "followups" ? "Follow-Ups" : "Actions"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-screen">
            <div className="spinner" /> Loading...
          </div>
        ) : (
          <>
            {tab === "history" && (
              <div>
                {!fullDeal?.stageHistory?.length ? (
                  <div className="empty-state">
                    <div className="empty-state-title">No stage history yet</div>
                  </div>
                ) : (
                  <div className="history-timeline">
                    {fullDeal.stageHistory.map((h) => (
                      <div key={h.id} className="history-item">
                        <div
                          className={`history-dot ${
                            h.toStage?.name?.toLowerCase().includes("won")
                              ? "dot-won"
                              : h.toStage?.name?.toLowerCase().includes("lost")
                              ? "dot-lost"
                              : ""
                          }`}
                        />
                        <div className="history-content">
                          <div className="history-text">
                            {h.fromStage ? (
                              <>
                                <strong style={{ color: "var(--text-primary)" }}>{h.fromStage.name}</strong>
                                {" -> "}
                                <strong style={{ color: "var(--accent)" }}>{h.toStage.name}</strong>
                              </>
                            ) : (
                              <>
                                Entered <strong style={{ color: "var(--accent)" }}>{h.toStage.name}</strong>
                              </>
                            )}
                            {h.note && (
                              <span style={{ color: "var(--text-muted)", fontSize: 12 }}> - {h.note}</span>
                            )}
                          </div>
                          <div className="history-meta">
                            by {h.movedBy?.firstName} {h.movedBy?.lastName} | {timeAgo(h.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "followups" && (
              <div>
                <div className="card" style={{ marginBottom: 16, padding: 14 }}>
                  <div className="form-label" style={{ marginBottom: 8 }}>
                    Schedule a Follow-Up
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <input
                        type="datetime-local"
                        className="input"
                        value={fuDate}
                        onChange={(e) => setFuDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-field" style={{ marginTop: 8 }}>
                    <input
                      className="input"
                      placeholder="Follow-up note..."
                      value={fuNote}
                      onChange={(e) => setFuNote(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={doCreateFollowUp}>
                    {busy ? "..." : "+ Schedule"}
                  </button>
                </div>
                {!fullDeal?.followUps?.length ? (
                  <div className="empty-state">
                    <div className="empty-state-title">No follow-ups scheduled</div>
                  </div>
                ) : (
                  fullDeal.followUps.map((fu: FollowUp) => (
                    <div
                      key={fu.id}
                      className={`followup-item ${
                        fu.status === "OVERDUE" ? "overdue" : fu.status === "COMPLETED" ? "completed" : ""
                      }`}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 3 }}>
                          {fu.note}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {formatDate(fu.scheduledAt)} | {fu.status}
                        </div>
                      </div>
                      {fu.status !== "COMPLETED" && (
                        <button
                          className="btn btn-success btn-xs"
                          disabled={busy}
                          onClick={() => doCompleteFollowUp(fu.id)}
                        >
                          Done
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "actions" && (
              <div>
                {d.state === "ACTIVE" && (
                  <>
                    <div className="card" style={{ marginBottom: 12, padding: 14 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                        Mark as Won
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                        This sets the deal state to WON and moves it to the Won stage.
                      </div>
                      <button className="btn btn-success" disabled={busy} onClick={doMarkWon}>
                        {busy ? "..." : "Mark Won"}
                      </button>
                    </div>
                    <div className="card" style={{ marginBottom: 12, padding: 14 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                        Mark as Lost
                      </div>
                      {!showLostForm ? (
                        <button className="btn btn-danger btn-sm" onClick={() => setShowLostForm(true)}>
                          Mark Lost...
                        </button>
                      ) : (
                        <>
                          <div className="form-field">
                            <label className="form-label">Lost Reason *</label>
                            <input
                              className="input"
                              placeholder="e.g. Budget constraints..."
                              value={lostReason}
                              onChange={(e) => setLostReason(e.target.value)}
                            />
                          </div>
                          <div className="form-field">
                            <label className="form-label">Additional Note</label>
                            <textarea
                              className="input"
                              placeholder="Optional details..."
                              value={lostNote}
                              onChange={(e) => setLostNote(e.target.value)}
                              style={{ minHeight: 60 }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button className="btn btn-danger" disabled={busy} onClick={doMarkLost}>
                              {busy ? "..." : "Confirm Lost"}
                            </button>
                            <button className="btn btn-secondary" onClick={() => setShowLostForm(false)}>
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
                {d.state === "WON" && (
                  <div className="card" style={{ marginBottom: 12, padding: 14 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                      Project Handoff
                    </div>
                    {d.handedOffAt ? (
                      <div className="alert alert-success">
                        Already handed off on {formatDate(d.handedOffAt)}
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                          Initiates a project handoff for this Won deal. Can only be done once.
                        </div>
                        <button className="btn btn-primary" disabled={busy} onClick={doHandoff}>
                          {busy ? "..." : "Initiate Handoff"}
                        </button>
                      </>
                    )}
                    {handoffResult && (
                      <div className="card" style={{ marginTop: 12, background: "var(--bg-elevated)", fontSize: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--accent)" }}>
                          Handoff Payload
                        </div>
                        <pre style={{ color: "var(--text-secondary)", overflowX: "auto", fontSize: 11 }}>
                          {JSON.stringify(handoffResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
                <div className="card" style={{ padding: 14 }}>
                  <div className="form-label" style={{ marginBottom: 6 }}>
                    Deal Info
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    <div className="flex justify-between mb-2">
                      <span style={{ color: "var(--text-muted)" }}>Owner</span>
                      <span>
                        {d.owner.firstName} {d.owner.lastName}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span style={{ color: "var(--text-muted)" }}>Category</span>
                      <span>{d.serviceCategory}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span style={{ color: "var(--text-muted)" }}>Created</span>
                      <span>{formatDate(d.createdAt)}</span>
                    </div>
                    {d.wonAt && (
                      <div className="flex justify-between mb-2">
                        <span style={{ color: "var(--text-muted)" }}>Won At</span>
                        <span style={{ color: "var(--green)" }}>{formatDate(d.wonAt)}</span>
                      </div>
                    )}
                    {d.tags?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ color: "var(--text-muted)", marginRight: 8 }}>Tags</span>
                        {d.tags.map((t) => (
                          <span
                            key={t}
                            style={{
                              background: "var(--bg-elevated)",
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: 11,
                              marginRight: 4,
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   Kanban View
   ========================================================= */
function KanbanView({
  pipeline,
  deals,
  onMoveDeal,
  onOpenDetail,
}: {
  pipeline: Pipeline;
  deals: Deal[];
  onMoveDeal: (dealId: string, toStageId: string) => Promise<void>;
  onOpenDetail: (d: Deal) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const activeStages = pipeline.stages.filter((s) => !s.isLost).sort((a, b) => a.order - b.order);
  const stageDeals = (stageId: string) =>
    deals.filter((d) => d.stage.id === stageId && d.state === "ACTIVE");
  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { over } = e;
    setActiveId(null);
    if (!over) return;
    const dealId = e.active.id as string;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const toStage = activeStages.find((s) => {
      if (stageDeals(s.id).some((d) => d.id === over.id)) return true;
      if (`col-${s.id}` === over.id) return true;
      return false;
    });
    if (!toStage || toStage.id === deal.stage.id) return;
    if (toStage.isWon || toStage.isLost) return;
    await onMoveDeal(dealId, toStage.id);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        {activeStages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={stageDeals(stage.id)}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>
      <DragOverlay>
        {activeDeal && (
          <div className="deal-card" style={{ opacity: 0.95, boxShadow: "var(--shadow)" }}>
            <div className="deal-card-title">{activeDeal.title}</div>
            <div className="deal-card-client">{activeDeal.client.name}</div>
            <div className="deal-card-value" style={{ color: "var(--text-primary)" }}>
              {formatCurrency(activeDeal.expectedValue, activeDeal.currency)}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/* =========================================================
   Sort Icon - module-level to avoid re-creating during render
   ========================================================= */
function SortIcon({ col, sortBy, sortOrder }: { col: string; sortBy: string; sortOrder: string }) {
  if (sortBy !== col) return <span style={{ color: "var(--text-muted)", fontSize: 10 }}> v</span>;
  return (
    <span style={{ color: "var(--accent)", fontSize: 10 }}>{sortOrder === "asc" ? " ^" : " v"}</span>
  );
}

/* =========================================================
   Deals Table View
   ========================================================= */
function DealsTableView({
  deals,
  pagination,
  onPageChange,
  onSortChange,
  sortBy,
  sortOrder,
  onStateFilter,
  stateFilter,
  searchQuery,
  onSearchChange,
  onOpenDetail,
}: {
  deals: Deal[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  onPageChange: (p: number) => void;
  onSortChange: (col: string) => void;
  sortBy: string;
  sortOrder: string;
  onStateFilter: (s: string) => void;
  stateFilter: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenDetail: (d: Deal) => void;
}) {
  const stateBadge: Record<string, string> = {
    ACTIVE: "badge-active",
    WON: "badge-won",
    LOST: "badge-lost",
    ARCHIVED: "badge-archived",
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Search deals or clients..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <select
          className="input"
          style={{ maxWidth: 160 }}
          value={stateFilter}
          onChange={(e) => onStateFilter(e.target.value)}
        >
          <option value="">All States</option>
          <option value="ACTIVE">Active</option>
          <option value="WON">Won</option>
          <option value="LOST">Lost</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
          {pagination.total} total deals
        </span>
      </div>

      {deals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No deals found</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Try changing the search or the state filter</div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <button className="btn btn-secondary btn-xs" onClick={() => onSortChange("title")}>
                    Deal <SortIcon col="title" sortBy={sortBy} sortOrder={sortOrder} />
                  </button>
                </th>
                <th>Client</th>
                <th>Stage</th>
                <th>Owner</th>
                <th>
                  <button className="btn btn-secondary btn-xs" onClick={() => onSortChange("expectedValue")}>
                    Value <SortIcon col="expectedValue" sortBy={sortBy} sortOrder={sortOrder} />
                  </button>
                </th>
                <th>
                  <button
                    className="btn btn-secondary btn-xs"
                    onClick={() => onSortChange("expectedCloseDate")}
                  >
                    Close Date <SortIcon col="expectedCloseDate" sortBy={sortBy} sortOrder={sortOrder} />
                  </button>
                </th>
                <th>State</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id}>
                  <td style={{ fontWeight: 600, maxWidth: 200 }} className="truncate">
                    {deal.title}
                  </td>
                  <td style={{ fontSize: 12 }}>{deal.client.name}</td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: deal.stage.color,
                          flexShrink: 0,
                        }}
                      />
                      {deal.stage.name}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {deal.owner.firstName} {deal.owner.lastName}
                  </td>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {formatCurrency(deal.expectedValue, deal.currency)}
                  </td>
                  <td style={{ fontSize: 12 }}>{formatDate(deal.expectedCloseDate)}</td>
                  <td>
                    <span className={`badge ${stateBadge[deal.state] || ""}`}>{deal.state}</span>
                    {deal.intelligence?.isStalled && (
                      <span
                        className="badge"
                        style={{ background: "var(--yellow-bg)", color: "var(--yellow)", marginLeft: 4 }}
                      >
                        {"\u26A0"} Stalled
                      </span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-xs" onClick={() => onOpenDetail(deal)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            disabled={!pagination.hasPrevPage}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            Prev
          </button>
          {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
            const pageNum = i + 1;
            return (
              <button
                key={pageNum}
                className={`page-btn ${pagination.page === pageNum ? "active" : ""}`}
                onClick={() => onPageChange(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            className="page-btn"
            disabled={!pagination.hasNextPage}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Follow-Ups reducer
   ========================================================= */
type FuState = { followUps: FollowUp[]; loading: boolean };
type FuAction =
  | { type: "FU_LOADING" }
  | { type: "FU_DONE"; data: FollowUp[] }
  | { type: "FU_ERROR" };

function fuReducer(state: FuState, action: FuAction): FuState {
  switch (action.type) {
    case "FU_LOADING":
      return { ...state, loading: true };
    case "FU_DONE":
      return { followUps: action.data, loading: false };
    case "FU_ERROR":
      return { ...state, loading: false };
    default:
      return state;
  }
}

/* =========================================================
   Follow-Ups Panel (agency-wide)
   ========================================================= */
function FollowUpsPanel({ toast }: { toast: ReturnType<typeof useToasts> }) {
  const [{ followUps, loading }, dispatch] = useReducer(fuReducer, { followUps: [], loading: true });
  const [statusFilter, setStatusFilter] = useState("UPCOMING");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "FU_LOADING" });
    api
      .getFollowUps(statusFilter || undefined)
      .then((data) => {
        if (!cancelled) dispatch({ type: "FU_DONE", data: Array.isArray(data) ? data : [] });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "FU_ERROR" });
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  async function complete(fuId: string) {
    setBusy(true);
    try {
      await api.updateFollowUp(fuId, { completedAt: new Date().toISOString() });
      toast.success("Follow-up completed!");
      dispatch({ type: "FU_LOADING" });
      api
        .getFollowUps(statusFilter || undefined)
        .then((data) => dispatch({ type: "FU_DONE", data: Array.isArray(data) ? data : [] }))
        .catch(() => dispatch({ type: "FU_ERROR" }));
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const statusBadge: Record<string, string> = {
    UPCOMING: "badge-upcoming",
    OVERDUE: "badge-overdue",
    COMPLETED: "badge-completed",
    RESCHEDULED: "badge-rescheduled",
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>Follow-Ups</h2>
        <select
          className="input"
          style={{ maxWidth: 180 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="UPCOMING">Upcoming</option>
          <option value="OVERDUE">Overdue</option>
          <option value="COMPLETED">Completed</option>
          <option value="RESCHEDULED">Rescheduled</option>
        </select>
      </div>
      {loading ? (
        <div className="loading-screen">
          <div className="spinner" /> Loading...
        </div>
      ) : followUps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No follow-ups found</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Open a deal and schedule a follow-up from the deal detail
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Note</th>
                <th>Deal</th>
                <th>Client</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {followUps.map((fu) => (
                <tr key={fu.id}>
                  <td style={{ maxWidth: 220 }} className="truncate">
                    {fu.note}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-primary)" }}>{fu.deal?.title}</td>
                  <td style={{ fontSize: 12 }}>{fu.deal?.client?.name}</td>
                  <td style={{ fontSize: 12 }}>{formatDate(fu.scheduledAt)}</td>
                  <td>
                    <span className={`badge ${statusBadge[fu.status]}`}>
                      {fu.status === "OVERDUE" ? "\u26A0 " : ""}
                      {fu.status}
                    </span>
                  </td>
                  <td>
                    {fu.status !== "COMPLETED" && (
                      <button
                        className="btn btn-success btn-xs"
                        disabled={busy}
                        onClick={() => complete(fu.id)}
                      >
                        Done
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Dashboard Stats
   ========================================================= */
type DashboardData = {
  summary?: { totalActiveDeals?: number; totalWonDeals?: number };
  pipelineValueByCurrency?: Record<string, number>;
};

function DashboardStats() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDashboard()
      .then((res: unknown) => {
        // Accept both a plain object and the standard { success, data } wrapper.
        const wrapped = res as { data?: DashboardData } & DashboardData;
        setStats(wrapped?.data ?? wrapped ?? null);
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="loading-screen">
        <div className="spinner" /> Loading stats...
      </div>
    );

  const summary = stats?.summary ?? {};
  const activeDeals = summary.totalActiveDeals ?? 0;
  const wonDeals = summary.totalWonDeals ?? 0;
  const valueEntries = Object.entries(stats?.pipelineValueByCurrency ?? {});
  const singleCurrency = valueEntries.length === 1 ? valueEntries[0] : null;
  const avgDeal = singleCurrency && activeDeals > 0 ? singleCurrency[1] / activeDeals : 0;

  return (
    <div>
      <div className="grid-stats mb-6">
        <div className="stat-card accent">
          <div className="stat-label">Active Deals</div>
          <div className="stat-value">{activeDeals}</div>
          <div className="stat-sub">Currently in pipeline</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Won Deals</div>
          <div className="stat-value">{wonDeals}</div>
          <div className="stat-sub">Closed as Won</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Pipeline Value</div>
          {valueEntries.length === 0 ? (
            <div className="stat-value">{formatCurrency(0)}</div>
          ) : (
            valueEntries.map(([cur, v]) => (
              <div
                key={cur}
                className="stat-value"
                style={{ fontSize: valueEntries.length > 1 ? 20 : 28, marginBottom: 4 }}
              >
                {formatCurrency(v, cur)}
              </div>
            ))
          )}
          <div className="stat-sub">
            {valueEntries.length > 1 ? "Shown per currency" : "Total expected value"}
          </div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">Avg Deal Size</div>
          {valueEntries.length > 1 ? (
            <div className="stat-value" style={{ fontSize: 16 }}>
              Multiple currencies
            </div>
          ) : (
            <div className="stat-value">
              {singleCurrency ? formatCurrency(avgDeal, singleCurrency[0]) : formatCurrency(0)}
            </div>
          )}
          <div className="stat-sub">Active deals avg</div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Login Screen
   ========================================================= */
function LoginScreen({ onLogin }: { onLogin: (auth: JwtPayload) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.login(email, password);
      localStorage.setItem("access_token", result.accessToken);
      localStorage.setItem("auth_user", JSON.stringify(result.user));
      onLogin(result);
    } catch (err: unknown) {
      setError((err as Error).message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <Logo />
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 6,
            color: "var(--text-primary)",
            letterSpacing: "-0.4px",
          }}
        >
          Sign In
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
          Use your agency credentials to continue
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <div className="flex items-center gap-2">
              <input
                id="login-password"
                className="input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="btn btn-secondary btn-xs"
                aria-label="Toggle password visibility"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button
            id="login-submit"
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", padding: "10px 0", marginTop: 8 }}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} /> Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   Main App
   ========================================================= */
type StoredAuth = JwtPayload | null;

export default function Home() {
  const [activeNav, setActiveNav] = useState<"dashboard" | "kanban" | "deals" | "followups">("kanban");

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string>("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState(false);
  const [auth, setAuth] = useState<StoredAuth>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [stateFilter, setStateFilter] = useState("");
  const [searchInput, setSearchInput] = useState(""); // what the user types
  const [searchQuery, setSearchQuery] = useState(""); // debounced value sent to the API
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const toast = useToasts();

  // Restore the session after a page refresh.
  useEffect(() => {
    try {
      const token = localStorage.getItem("access_token");
      const user = localStorage.getItem("auth_user");
      if (token && user) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAuth({ accessToken: token, user: JSON.parse(user) } as unknown as JwtPayload);
      }
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("auth_user");
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthChecked(true);
  }, []);

  // Load pipelines after login
  useEffect(() => {
    if (!auth) return;
    api
      .getPipelines()
      .then((ps) => {
        setPipelines(ps);
        const def = ps.find((p) => p.isDefault) || ps[0];
        if (def) setActivePipelineId(def.id);
      })
      .catch((e) => toast.error(`Pipelines: ${e.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const toastError = toast.error;
  const loadDeals = useCallback(async () => {
    if (!auth) return;
    const params: Record<string, string | number> = { page, limit: 50, sortBy, sortOrder };
    // Filters from the All Deals screen must not affect the Kanban board.
    if (activeNav === "deals") {
      if (stateFilter) params.state = stateFilter;
      if (searchQuery) params.search = searchQuery;
    }
    if (activePipelineId && activeNav === "kanban") params.pipelineId = activePipelineId;

    return Promise.resolve()
      .then(() => {
        setLoading(true);
        return api.getDeals(params);
      })
      .then((res) => {
        setDeals(Array.isArray(res) ? res : res.deals || []);
        if (!Array.isArray(res)) setPagination(res.pagination);
        setLoading(false);
      })
      .catch((e: unknown) => {
        toastError(`Deals: ${(e as Error).message}`);
        setLoading(false);
      });
  }, [auth, page, sortBy, sortOrder, stateFilter, searchQuery, activePipelineId, activeNav, toastError]);

  // Auto-reload when deps change
  useEffect(() => {
    if (!auth) return;
    void loadDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDeals]);

  function handleSearchChange(q: string) {
    setSearchInput(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchQuery(q);
      setPage(1);
    }, 400);
  }

  function handleStateFilter(s: string) {
    setStateFilter(s);
    setPage(1);
  }

  function handleSortChange(col: string) {
    if (sortBy === col) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortOrder("asc");
    }
    setPage(1);
  }

  async function handleMoveDeal(dealId: string, toStageId: string) {
    const original = deals;
    const pipeline = pipelines.find((p) => p.id === activePipelineId);
    const toStage = pipeline?.stages.find((s) => s.id === toStageId);
    if (!toStage) return;

    // Optimistic update with rollback on failure.
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? ({ ...d, stage: toStage, stageId: toStageId } as Deal) : d))
    );

    try {
      await api.moveDealStage(dealId, toStageId);
      toast.success(`Moved to "${toStage.name}"`);
    } catch (e: unknown) {
      setDeals(original);
      toast.error(`Move failed: ${(e as Error).message}`);
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
    setAuth(null);
    setDeals([]);
    setPipelines([]);
    setDetailDeal(null);
    setActivePipelineId("");
    setActiveNav("dashboard");
  }

  const activePipeline = pipelines.find((p) => p.id === activePipelineId);

  if (!authChecked) return null;

  if (!auth)
    return (
      <LoginScreen
        onLogin={(a) => {
          setAuth(a);
        }}
      />
    );

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <Logo />

          <nav className="sidebar-nav">
            <div className="nav-section-label">Overview</div>
            <button
              className={`nav-item ${activeNav === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveNav("dashboard")}
            >
              <span className="nav-item-icon">D</span> Dashboard
            </button>
            <div className="nav-section-label">Pipeline</div>
            <button
              className={`nav-item ${activeNav === "kanban" ? "active" : ""}`}
              onClick={() => setActiveNav("kanban")}
            >
              <span className="nav-item-icon">K</span> Kanban Board
            </button>
            <button
              className={`nav-item ${activeNav === "deals" ? "active" : ""}`}
              onClick={() => setActiveNav("deals")}
            >
              <span className="nav-item-icon">A</span> All Deals
            </button>
            <div className="nav-section-label">Tasks</div>
            <button
              className={`nav-item ${activeNav === "followups" ? "active" : ""}`}
              onClick={() => setActiveNav("followups")}
            >
              <span className="nav-item-icon">F</span> Follow-Ups
            </button>
            {activeNav === "kanban" && pipelines.length > 1 && (
              <>
                <div className="nav-section-label" style={{ marginTop: 8 }}>
                  Pipelines
                </div>
                {pipelines.map((p) => (
                  <button
                    key={p.id}
                    className={`nav-item ${activePipelineId === p.id ? "active" : ""}`}
                    onClick={() => setActivePipelineId(p.id)}
                  >
                    <span className="nav-item-icon">-</span>
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </>
            )}
          </nav>

          <div className="sidebar-user">
            <div className="sidebar-user-name">
              {auth.user.firstName} {auth.user.lastName}
            </div>
            <div className="sidebar-user-role">{auth.user.roles.join(", ")}</div>
            <button
              className="btn btn-secondary btn-xs"
              style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>
        </aside>

        <div className="main-content">
          <div className="topbar">
            <div className="topbar-title">
              {activeNav === "dashboard" && "Sales Dashboard"}
              {activeNav === "kanban" && `Kanban - ${activePipeline?.name || "Loading..."}`}
              {activeNav === "deals" && "All Deals"}
              {activeNav === "followups" && "Follow-Ups"}
            </div>
            {loading && <div className="spinner" />}
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{auth.user.email}</span>
          </div>

          <div className="page-content">
            {activeNav === "dashboard" && <DashboardStats />}

            {activeNav === "kanban" &&
              (activePipeline ? (
                <KanbanView
                  pipeline={activePipeline}
                  deals={deals}
                  onMoveDeal={handleMoveDeal}
                  onOpenDetail={setDetailDeal}
                />
              ) : (
                <div className="loading-screen">
                  <div className="spinner" /> Loading pipeline...
                </div>
              ))}

            {activeNav === "deals" && (
              <DealsTableView
                deals={deals}
                pagination={pagination}
                onPageChange={setPage}
                onSortChange={handleSortChange}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onStateFilter={handleStateFilter}
                stateFilter={stateFilter}
                searchQuery={searchInput}
                onSearchChange={handleSearchChange}
                onOpenDetail={setDetailDeal}
              />
            )}

            {activeNav === "followups" && <FollowUpsPanel toast={toast} />}
          </div>
        </div>
      </div>

      {detailDeal && (
        <DealDetailModal
          deal={detailDeal}
          onClose={() => setDetailDeal(null)}
          onRefresh={loadDeals}
          toast={toast}
        />
      )}

      <div className="toast-container">
        {toast.toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "success" ? "OK" : t.type === "error" ? "ERR" : "INFO"} {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}