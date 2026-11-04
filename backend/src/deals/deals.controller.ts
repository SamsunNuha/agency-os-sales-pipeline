import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { MoveDealStageDto } from './dto/move-deal-stage.dto';
import { MarkDealLostDto } from './dto/mark-deal-lost.dto';
import { DealQueryDto } from './dto/deal-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtUser } from '../common/types/jwt-user.type';

@ApiTags('deals')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new deal' })
  @ApiResponse({ status: 201, description: 'Deal created successfully' })
  async create(@Body() dto: CreateDealDto, @CurrentUser() user: JwtUser) {
    return this.dealsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List all deals (with search, filter, sort, pagination)' })
  async findAll(@Query() query: DealQueryDto, @CurrentUser() user: JwtUser) {
    return this.dealsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single deal with full detail' })
  @ApiParam({ name: 'id', description: 'Deal UUID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.dealsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update deal details' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.dealsService.update(id, dto, user);
  }

  @Patch(':id/stage')
  @ApiOperation({ summary: 'Move a deal to a different stage (Kanban drag-and-drop)' })
  async moveStage(
    @Param('id') id: string,
    @Body() dto: MoveDealStageDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.dealsService.moveStage(id, dto, user);
  }

  @Patch(':id/won')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a deal as Won' })
  async markWon(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.dealsService.markWon(id, user);
  }

  @Patch(':id/lost')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a deal as Lost (requires lost reason)' })
  async markLost(
    @Param('id') id: string,
    @Body() dto: MarkDealLostDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.dealsService.markLost(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a deal' })
  async archive(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.dealsService.archive(id, user);
  }
}
