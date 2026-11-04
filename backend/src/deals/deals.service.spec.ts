import { Test, TestingModule } from '@nestjs/testing';
import { DealsService } from './deals.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DealState, ActivityType, FollowUpStatus } from '@prisma/client';
import { ProbabilityService } from '../probability/probability.service';

/* ─────────────────────────────────────────────────────────
   Mocks
───────────────────────────────────────────────────────── */
const mockDeal = {
  id: 'deal-1',
  agencyId: 'agency-1',
  title: 'Test Deal',
  clientId: 'client-1',
  ownerId: 'user-1',
  pipelineId: 'pipeline-1',
  stageId: 'stage-1',
  expectedValue: 10000,
  currency: 'USD',
  serviceCategory: 'Web Development',
  state: DealState.ACTIVE,
  expectedCloseDate: new Date('2025-06-01'),
  tags: [],
  notes: null,
  lostReason: null,
  lostNote: null,
  wonAt: null,
  lostAt: null,
  archivedAt: null,
  handedOffAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockStage = {
  id: 'stage-1',
  name: 'Qualified',
  slug: 'qualified',
  order: 2,
  probability: 25,
  color: '#3B82F6',
  pipelineId: 'pipeline-1',
  agencyId: 'agency-1',
  isWon: false,
  isLost: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockWonStage = { ...mockStage, id: 'stage-won', name: 'Won', slug: 'won', isWon: true, probability: 100 };
const mockLostStage = { ...mockStage, id: 'stage-lost', name: 'Lost', slug: 'lost', isLost: true, probability: 0 };

const mockUser = { sub: 'user-1', email: 'test@test.com', agencyId: 'agency-1', roles: ['ADMIN'] };

function createMockPrisma() {
  return {
    deal: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    pipelineStage: {
      findFirst: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    dealStageHistory: {
      create: jest.fn(),
    },
    dealActivity: {
      create: jest.fn(),
    },
    dealIntelligence: {
      create: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        deal: { create: jest.fn().mockResolvedValue({ ...mockDeal, stage: mockStage }), update: jest.fn().mockResolvedValue(mockDeal) },
        dealStageHistory: { create: jest.fn() },
        dealActivity: { create: jest.fn() },
        dealIntelligence: { create: jest.fn(), upsert: jest.fn() },
      }),
    ),
  };
}

/* ─────────────────────────────────────────────────────────
   Test Suite
───────────────────────────────────────────────────────── */
describe('DealsService', () => {
  let service: DealsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProbabilityService, useValue: { calculateForDeal: jest.fn().mockResolvedValue({ probability: 0, signals: {}, version: 'v1.0' }) } },
      ],
    }).compile();

    service = module.get<DealsService>(DealsService);
  });

  /* ──────────────────────────────────────────────────────
     findAll — pagination
  ────────────────────────────────────────────────────── */
  describe('findAll', () => {
    it('returns paginated deals with correct metadata', async () => {
      const mockDeals = [mockDeal];
      prisma.$transaction.mockResolvedValueOnce([1, mockDeals]);

      const result = await service.findAll({ page: 1, limit: 20 }, mockUser);

      expect(result).toHaveProperty('deals');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('filters by state when provided', async () => {
      prisma.$transaction.mockResolvedValueOnce([0, []]);
      await service.findAll({ page: 1, limit: 20, state: 'WON' }, mockUser);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('applies search filter', async () => {
      prisma.$transaction.mockResolvedValueOnce([0, []]);
      await service.findAll({ page: 1, limit: 20, search: 'Acme' }, mockUser);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  /* ──────────────────────────────────────────────────────
     moveStage
  ────────────────────────────────────────────────────── */
  describe('moveStage', () => {
    it('throws BadRequestException if deal is already in the target stage', async () => {
      prisma.deal.findFirst.mockResolvedValue(mockDeal);
      await expect(
        service.moveStage('deal-1', { stageId: 'stage-1' }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if target stage not found in pipeline', async () => {
      prisma.deal.findFirst.mockResolvedValue(mockDeal);
      prisma.pipelineStage.findFirst.mockResolvedValue(null);
      await expect(
        service.moveStage('deal-1', { stageId: 'stage-2' }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when trying to move to Won stage via moveStage', async () => {
      prisma.deal.findFirst.mockResolvedValue(mockDeal);
      prisma.pipelineStage.findFirst.mockResolvedValue(mockWonStage);
      await expect(
        service.moveStage('deal-1', { stageId: mockWonStage.id }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when trying to move to Lost stage via moveStage', async () => {
      prisma.deal.findFirst.mockResolvedValue(mockDeal);
      prisma.pipelineStage.findFirst.mockResolvedValue(mockLostStage);
      await expect(
        service.moveStage('deal-1', { stageId: mockLostStage.id }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if deal not found', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);
      await expect(
        service.moveStage('nonexistent', { stageId: 'stage-2' }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if deal is not active', async () => {
      prisma.deal.findFirst.mockResolvedValue({ ...mockDeal, state: DealState.WON });
      await expect(
        service.moveStage('deal-1', { stageId: 'stage-2' }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ──────────────────────────────────────────────────────
     markWon
  ────────────────────────────────────────────────────── */
  describe('markWon', () => {
    it('throws ConflictException if deal is already won', async () => {
      prisma.deal.findFirst.mockResolvedValue({ ...mockDeal, state: DealState.WON });
      await expect(service.markWon('deal-1', mockUser)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if deal is already lost', async () => {
      prisma.deal.findFirst.mockResolvedValue({ ...mockDeal, state: DealState.LOST });
      await expect(service.markWon('deal-1', mockUser)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if deal not found', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);
      await expect(service.markWon('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  /* ──────────────────────────────────────────────────────
     markLost
  ────────────────────────────────────────────────────── */
  describe('markLost', () => {
    it('throws ConflictException if deal is already lost', async () => {
      prisma.deal.findFirst.mockResolvedValue({ ...mockDeal, state: DealState.LOST });
      await expect(
        service.markLost('deal-1', { lostReason: 'Budget' }, mockUser),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if deal not found', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);
      await expect(
        service.markLost('nonexistent', { lostReason: 'Budget' }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ──────────────────────────────────────────────────────
     archive
  ────────────────────────────────────────────────────── */
  describe('archive', () => {
    it('throws ConflictException if deal is already archived', async () => {
      prisma.deal.findFirst.mockResolvedValue({ ...mockDeal, state: DealState.ARCHIVED });
      await expect(service.archive('deal-1', mockUser)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if deal not found', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);
      await expect(service.archive('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  /* ──────────────────────────────────────────────────────
     findOne
  ────────────────────────────────────────────────────── */
  describe('findOne', () => {
    it('throws NotFoundException if deal not found', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });
});
