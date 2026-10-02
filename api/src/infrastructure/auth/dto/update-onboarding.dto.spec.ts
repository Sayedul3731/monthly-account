import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateOnboardingDto } from './update-onboarding.dto';

describe('UpdateOnboardingDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });
  const validate = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: UpdateOnboardingDto });

  it.each([0, 1, 2, 3, 4])('accepts step %s', async (step) => {
    await expect(validate({ step })).resolves.toMatchObject({ step });
  });

  it.each(['completed', 'skipped'])(
    'accepts the %s outcome',
    async (status) => {
      await expect(validate({ status })).resolves.toMatchObject({ status });
    },
  );

  it.each([-1, 5, 1.5, '1', null])(
    'rejects an invalid step: %s',
    async (step) => {
      await expect(validate({ step })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it.each(['pending', 'invalid', null])(
    'rejects an invalid outcome: %s',
    async (status) => {
      await expect(validate({ status })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('rejects attempts to change another user or membership', async () => {
    await expect(
      validate({ step: 1, userId: 'another-user', membershipId: 'premium' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['2026-10', '2000-01', '2100-12'])(
    'accepts setup month %s',
    async (period) => {
      await expect(validate({ period })).resolves.toMatchObject({ period });
    },
  );

  it.each([
    '2026-00',
    '2026-13',
    '1999-10',
    '2101-01',
    '2026-10-02',
    null,
    202610,
  ])('rejects invalid setup month %s', async (period) => {
    await expect(validate({ period })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
