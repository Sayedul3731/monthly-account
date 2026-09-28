import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });

  it('rejects self-service membership changes', async () => {
    await expect(
      pipe.transform(
        {
          membershipId: '507f1f77bcf86cd799439011',
          billingInterval: 'monthly',
        },
        { type: 'body', metatype: UpdateProfileDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
