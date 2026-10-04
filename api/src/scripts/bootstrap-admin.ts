import 'dotenv/config';
import mongoose, { Types } from 'mongoose';

/** Promote an existing account; never create or print a default password. */
async function bootstrapAdmin(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!uri || !email)
    throw new Error(
      'Set MONGODB_URI and BOOTSTRAP_ADMIN_EMAIL to your existing account email.',
    );
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const roles = mongoose.connection.collection('app_roles');
  const users = mongoose.connection.collection('users');
  const adminRole = await roles.findOne({ name: 'admin', deletedAt: null });
  if (!adminRole)
    throw new Error(
      'Start the API once to seed its built-in roles before bootstrapping.',
    );
  if (await users.countDocuments({ roleId: adminRole._id, deletedAt: null })) {
    throw new Error(
      'An active administrator already exists. Use the admin panel for later role assignments.',
    );
  }
  const user = await users.findOne({ email, deletedAt: null });
  if (!user)
    throw new Error('Register the intended administrator account first.');
  const result = await users.updateOne(
    { _id: new Types.ObjectId(user._id), deletedAt: null },
    {
      $set: { roleId: adminRole._id, refreshToken: null },
      $inc: { authenticationVersion: 1 },
    },
  );
  if (!result.modifiedCount)
    throw new Error('The account could not be promoted.');
  console.log(
    'First administrator assigned. Sign in again to access the admin panel.',
  );
}

void bootstrapAdmin()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'Administrator bootstrap failed.',
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
