import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResourceResponseDto } from './dto/resource-response.dto';
import { ResourcesService } from './resources.service';

@ApiTags('resources')
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: 'List all rooms' })
  @ApiOkResponse({ type: ResourceResponseDto, isArray: true })
  async findAll(): Promise<ResourceResponseDto[]> {
    const rooms = await this.resourcesService.findAll();
    return rooms.map(ResourceResponseDto.fromEntity);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one room' })
  @ApiOkResponse({ type: ResourceResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResourceResponseDto> {
    const room = await this.resourcesService.findOne(id);
    if (!room) throw new NotFoundException('Room not found');
    return ResourceResponseDto.fromEntity(room);
  }
}
